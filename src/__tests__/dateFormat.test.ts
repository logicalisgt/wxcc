import { toWxccFormat, safeToWxccFormat, convertObjectDatesToWxcc, isWxccFormat } from '../utils/dateFormat';

describe('Date Formatting Utilities', () => {
  describe('toWxccFormat', () => {
    it('should convert ISO string with seconds/milliseconds to WxCC format', () => {
      const isoString = '2024-01-15T09:30:45.123Z';
      const result = toWxccFormat(isoString);
      
      expect(result).toBe('2024-01-15T09:30');
      expect(isWxccFormat(result)).toBe(true);
    });

    it('should convert ISO string without milliseconds to WxCC format', () => {
      const isoString = '2024-01-15T09:30:00Z';
      const result = toWxccFormat(isoString);
      
      expect(result).toBe('2024-01-15T09:30');
      expect(isWxccFormat(result)).toBe(true);
    });

    it('should handle Date objects correctly', () => {
      const date = new Date('2024-01-15T09:30:45.123Z');
      const result = toWxccFormat(date);
      
      expect(result).toBe('2024-01-15T09:30');
      expect(isWxccFormat(result)).toBe(true);
    });

    it('should throw error for invalid date input', () => {
      expect(() => toWxccFormat('invalid-date')).toThrow('Invalid date input');
    });

    it('should handle different time zones correctly', () => {
      // ISO string in different timezone should still format correctly
      const isoString = '2024-01-15T14:30:00+05:00'; // 09:30 UTC
      const result = toWxccFormat(isoString);
      
      // Should convert to UTC and format
      expect(result).toBe('2024-01-15T09:30');
    });
  });

  describe('safeToWxccFormat', () => {
    it('should convert valid dates safely', () => {
      const isoString = '2024-01-15T09:30:45.123Z';
      const result = safeToWxccFormat(isoString);
      
      expect(result).toBe('2024-01-15T09:30');
    });

    it('should return fallback for invalid dates when provided', () => {
      const result = safeToWxccFormat('invalid-date', 'fallback');
      
      expect(result).toBe('fallback');
    });

    it('should throw error for invalid dates when no fallback provided', () => {
      expect(() => safeToWxccFormat('invalid-date')).toThrow();
    });
  });

  describe('convertObjectDatesToWxcc', () => {
    it('should convert specified date fields in an object', () => {
      const updateData = {
        workingHours: true,
        startDateTime: '2024-01-15T09:30:45.123Z',
        endDateTime: '2024-01-15T17:30:00Z',
        nonDateField: 'unchanged'
      };

      const result = convertObjectDatesToWxcc(updateData, ['startDateTime', 'endDateTime']);

      expect(result.startDateTime).toBe('2024-01-15T09:30');
      expect(result.endDateTime).toBe('2024-01-15T17:30');
      expect(result.workingHours).toBe(true);
      expect(result.nonDateField).toBe('unchanged');
    });

    it('should handle missing date fields gracefully', () => {
      const updateData: Record<string, any> = {
        workingHours: true,
        startDateTime: '2024-01-15T09:30:45.123Z'
        // endDateTime is missing
      };

      const result = convertObjectDatesToWxcc(updateData, ['startDateTime', 'endDateTime']);

      expect(result.startDateTime).toBe('2024-01-15T09:30');
      expect(result.endDateTime).toBeUndefined();
      expect(result.workingHours).toBe(true);
    });
  });

  describe('isWxccFormat', () => {
    it('should validate correct WxCC format', () => {
      expect(isWxccFormat('2024-01-15T09:30')).toBe(true);
      expect(isWxccFormat('2024-12-31T23:59')).toBe(true);
    });

    it('should reject incorrect formats', () => {
      expect(isWxccFormat('2024-01-15T09:30:45')).toBe(false); // has seconds
      expect(isWxccFormat('2024-01-15T09:30:45.123Z')).toBe(false); // has seconds and milliseconds
      expect(isWxccFormat('2024-01-15 09:30')).toBe(false); // space instead of T
      expect(isWxccFormat('2024/01/15T09:30')).toBe(false); // wrong date separator
      expect(isWxccFormat('invalid')).toBe(false);
    });
  });

  describe('WxCC API Integration Examples', () => {
    it('should demonstrate typical usage in override updates', () => {
      // Simulating data coming from frontend (with seconds/milliseconds)
      const frontendData = {
        workingHours: true,
        startDateTime: '2024-01-15T09:30:45.123Z',
        endDateTime: '2024-01-15T17:30:00Z'
      };

      // Convert for WxCC API
      const wxccData = convertObjectDatesToWxcc(frontendData, ['startDateTime', 'endDateTime']);

      expect(wxccData.startDateTime).toBe('2024-01-15T09:30');
      expect(wxccData.endDateTime).toBe('2024-01-15T17:30');
      
      // Verify WxCC format compliance
      expect(isWxccFormat(wxccData.startDateTime)).toBe(true);
      expect(isWxccFormat(wxccData.endDateTime)).toBe(true);
    });
  });
});