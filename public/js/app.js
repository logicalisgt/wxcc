/**
 * WxCC Override Agent Scheduling Frontend Application
 * Professional, user-friendly interface for agent scheduling
 */

class WxccAgentScheduler {
    constructor() {
        this.containers = [];
        this.filteredContainers = [];
        this.currentAgent = null;
        this.searchTerm = '';
        this.statusFilter = 'all';
        this.containerFilter = 'all';
        this.apiBaseUrl = '/api';
        
        this.init();
    }

    init() {
        this.bindEventListeners();
        this.loadContainers();
    }

    bindEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('agentSearch');
        const clearSearch = document.getElementById('clearSearch');
        
        searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        clearSearch.addEventListener('click', () => this.clearSearch());

        // Filters
        const statusFilter = document.getElementById('statusFilter');
        const containerFilter = document.getElementById('containerFilter');
        
        statusFilter.addEventListener('change', (e) => this.handleStatusFilter(e.target.value));
        containerFilter.addEventListener('change', (e) => this.handleContainerFilter(e.target.value));

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadContainers());

        // Retry button
        document.getElementById('retryBtn').addEventListener('click', () => this.loadContainers());

        // Modal handlers
        this.bindModalEventListeners();
    }

    bindModalEventListeners() {
        const modal = document.getElementById('scheduleModal');
        const closeModal = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelBtn');
        const scheduleForm = document.getElementById('scheduleForm');
        const workingHoursToggle = document.getElementById('workingHours');

        closeModal.addEventListener('click', () => this.closeModal());
        cancelBtn.addEventListener('click', () => this.closeModal());
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        // Working hours toggle
        workingHoursToggle.addEventListener('change', (e) => {
            const text = document.getElementById('workingHoursText');
            text.textContent = e.target.checked ? 'Active' : 'Inactive';
        });

        // Form submission
        scheduleForm.addEventListener('submit', (e) => this.handleScheduleSubmit(e));

        // Real-time validation
        const startDateTime = document.getElementById('startDateTime');
        const endDateTime = document.getElementById('endDateTime');
        
        startDateTime.addEventListener('change', () => this.validateForm());
        endDateTime.addEventListener('change', () => this.validateForm());
    }

    async loadContainers() {
        try {
            this.showLoadingState();
            
            const response = await fetch(`${this.apiBaseUrl}/overrides/containers`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.containers = data.data;
                this.updateContainerFilter();
                this.applyFilters();
                this.showContent();
                this.showToast('success', 'Data loaded successfully', `Loaded ${this.containers.length} containers`);
            } else {
                throw new Error(data.message || 'Failed to load data');
            }
            
        } catch (error) {
            console.error('Failed to load containers:', error);
            this.showErrorState(error.message);
            this.showToast('error', 'Loading failed', error.message);
        }
    }

    updateContainerFilter() {
        const containerFilter = document.getElementById('containerFilter');
        
        // Clear existing options except "All Containers"
        while (containerFilter.children.length > 1) {
            containerFilter.removeChild(containerFilter.lastChild);
        }
        
        // Add container options
        this.containers.forEach(container => {
            const option = document.createElement('option');
            option.value = container.id;
            option.textContent = container.name;
            containerFilter.appendChild(option);
        });
    }

    handleSearch(term) {
        this.searchTerm = term.toLowerCase();
        const clearSearch = document.getElementById('clearSearch');
        
        clearSearch.style.display = term ? 'block' : 'none';
        this.applyFilters();
    }

    clearSearch() {
        const searchInput = document.getElementById('agentSearch');
        const clearSearch = document.getElementById('clearSearch');
        
        searchInput.value = '';
        this.searchTerm = '';
        clearSearch.style.display = 'none';
        this.applyFilters();
    }

    handleStatusFilter(status) {
        this.statusFilter = status;
        this.applyFilters();
    }

    handleContainerFilter(containerId) {
        this.containerFilter = containerId;
        this.applyFilters();
    }

    applyFilters() {
        if (!this.containers.length) return;

        this.filteredContainers = this.containers.map(container => {
            // Filter container if specific one selected
            if (this.containerFilter !== 'all' && container.id !== this.containerFilter) {
                return null;
            }

            // Filter agents within container
            const filteredAgents = container.agents.filter(agent => {
                // Search filter
                if (this.searchTerm && !agent.agentId.toLowerCase().includes(this.searchTerm)) {
                    return false;
                }

                // Status filter
                if (this.statusFilter !== 'all') {
                    const today = new Date().toISOString().split('T')[0];
                    
                    switch (this.statusFilter) {
                        case 'active':
                            return agent.status === 'active';
                        case 'scheduled':
                            const agentDate = agent.startDateTime.split('T')[0];
                            return agent.status === 'scheduled' && agentDate === today;
                        case 'inactive':
                            return agent.status === 'inactive';
                        default:
                            return true;
                    }
                }

                return true;
            });

            // Return container with filtered agents, or null if no agents match
            if (filteredAgents.length === 0 && this.containerFilter === 'all' && 
                (this.searchTerm || this.statusFilter !== 'all')) {
                return null;
            }

            return {
                ...container,
                agents: filteredAgents,
                totalAgents: filteredAgents.length,
                activeAgents: filteredAgents.filter(agent => agent.isCurrentlyActive),
                activeCount: filteredAgents.filter(agent => agent.isCurrentlyActive).length
            };
        }).filter(container => container !== null);

        this.renderContainers();
    }

    renderContainers() {
        const containersContent = document.getElementById('containersContent');
        
        if (this.filteredContainers.length === 0) {
            containersContent.innerHTML = this.getNoDataTemplate();
            return;
        }

        containersContent.innerHTML = this.filteredContainers
            .map(container => this.getContainerTemplate(container))
            .join('');

        // Bind agent card event listeners
        this.bindAgentEventListeners();
    }

    bindAgentEventListeners() {
        // Schedule buttons
        document.querySelectorAll('.schedule-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const agentId = e.currentTarget.dataset.agentId;
                const containerId = e.currentTarget.dataset.containerId;
                this.openScheduleModal(containerId, agentId);
            });
        });
    }

    getNoDataTemplate() {
        const hasFilters = this.searchTerm || this.statusFilter !== 'all' || this.containerFilter !== 'all';
        
        return `
            <div class="error-container">
                <div class="error-content">
                    <i class="fas fa-search error-icon" style="color: var(--gray-400);"></i>
                    <h3 class="error-title">No ${hasFilters ? 'matching ' : ''}agents found</h3>
                    <p class="error-message">
                        ${hasFilters 
                            ? 'Try adjusting your search criteria or filters.' 
                            : 'No agent data is currently available.'}
                    </p>
                    ${hasFilters ? '<button class="btn btn-secondary" onclick="app.clearAllFilters()"><i class="fas fa-times"></i> Clear Filters</button>' : ''}
                </div>
            </div>
        `;
    }

    clearAllFilters() {
        // Reset all filters
        document.getElementById('agentSearch').value = '';
        document.getElementById('statusFilter').value = 'all';
        document.getElementById('containerFilter').value = 'all';
        
        this.searchTerm = '';
        this.statusFilter = 'all';
        this.containerFilter = 'all';
        
        document.getElementById('clearSearch').style.display = 'none';
        this.applyFilters();
    }

    getContainerTemplate(container) {
        return `
            <div class="container-card">
                <div class="container-header">
                    <h2 class="container-title">${this.escapeHtml(container.name)}</h2>
                    ${container.description ? `<p class="container-description">${this.escapeHtml(container.description)}</p>` : ''}
                </div>
                
                ${this.getActiveAgentsSection(container)}
                
                <div class="agents-grid">
                    ${container.agents.map(agent => this.getAgentCardTemplate(agent)).join('')}
                </div>
            </div>
        `;
    }

    getActiveAgentsSection(container) {
        const hasActiveAgents = container.activeAgents.length > 0;
        
        return `
            <div class="active-agents-section ${hasActiveAgents ? '' : 'no-active'}">
                <h3 class="active-agents-title">
                    <i class="fas ${hasActiveAgents ? 'fa-user-check' : 'fa-user-slash'}"></i>
                    Currently Active Agent${container.activeCount === 1 ? '' : 's'}:
                </h3>
                ${hasActiveAgents 
                    ? `<div class="active-agents-list">
                        ${container.activeAgents.map(agent => 
                            `<span class="active-agent-badge">
                                <i class="fas fa-star"></i>
                                ${this.escapeHtml(agent.agentId)}
                            </span>`
                        ).join('')}
                       </div>`
                    : '<p class="no-active-message">No agents are currently active</p>'
                }
            </div>
        `;
    }

    getAgentCardTemplate(agent) {
        const statusIcon = this.getStatusIcon(agent.status);
        const isActive = agent.isCurrentlyActive;
        
        return `
            <div class="agent-card ${isActive ? 'agent-active' : ''}" data-agent-id="${agent.agentId}">
                <div class="agent-header">
                    <div>
                        <h3 class="agent-name">
                            ${isActive ? '<i class="fas fa-star spotlight-icon"></i>' : ''}
                            ${this.escapeHtml(agent.agentId)}
                        </h3>
                        <div class="agent-status status-${agent.status} tooltip" data-tooltip="${this.getStatusTooltip(agent.status)}">
                            <i class="fas ${statusIcon} status-icon"></i>
                            ${agent.status}
                        </div>
                    </div>
                </div>
                
                <div class="agent-schedule">
                    <div><strong>Schedule:</strong></div>
                    <div>${this.formatDateTime(agent.startDateTime)} - ${this.formatDateTime(agent.endDateTime)}</div>
                    <div><small>Working Hours: ${agent.workingHours ? 'Yes' : 'No'}</small></div>
                </div>
                
                <div class="agent-actions">
                    <button class="btn btn-primary btn-small schedule-btn" 
                            data-agent-id="${agent.agentId}" 
                            data-container-id="${agent.containerId}">
                        <i class="fas fa-calendar-alt"></i>
                        Schedule
                    </button>
                </div>
            </div>
        `;
    }

    getStatusIcon(status) {
        const icons = {
            'active': 'fa-check-circle',
            'inactive': 'fa-circle',
            'scheduled': 'fa-clock',
            'expired': 'fa-times-circle'
        };
        return icons[status] || 'fa-question-circle';
    }

    getStatusTooltip(status) {
        const tooltips = {
            'active': 'Agent is currently active and working',
            'inactive': 'Agent is not scheduled or working',
            'scheduled': 'Agent is scheduled for future work',
            'expired': 'Agent\'s schedule has expired'
        };
        return tooltips[status] || 'Unknown status';
    }

    async openScheduleModal(containerId, agentId) {
        const container = this.containers.find(c => c.id === containerId);
        const agent = container?.agents.find(a => a.agentId === agentId);
        
        if (!agent) {
            this.showToast('error', 'Agent not found', 'Unable to find the selected agent');
            return;
        }

        this.currentAgent = { ...agent, containerId };
        
        // Populate modal fields
        document.getElementById('modalAgentName').textContent = agent.agentId;
        document.getElementById('modalContainerName').textContent = container.name;
        document.getElementById('workingHours').checked = agent.workingHours;
        document.getElementById('workingHoursText').textContent = agent.workingHours ? 'Active' : 'Inactive';
        document.getElementById('startDateTime').value = this.toLocalDateTimeString(agent.startDateTime);
        document.getElementById('endDateTime').value = this.toLocalDateTimeString(agent.endDateTime);
        
        // Clear validation messages
        document.getElementById('validationMessages').innerHTML = '';
        
        // Show modal
        const modal = document.getElementById('scheduleModal');
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('startDateTime').focus();
        }, 300);
    }

    closeModal() {
        const modal = document.getElementById('scheduleModal');
        modal.classList.remove('show');
        document.body.style.overflow = '';
        this.currentAgent = null;
    }

    async handleScheduleSubmit(e) {
        e.preventDefault();
        
        if (!this.currentAgent) return;
        
        const formData = this.getFormData();
        
        if (!this.validateFormData(formData)) {
            return;
        }

        try {
            const saveBtn = document.getElementById('saveBtn');
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveBtn.disabled = true;

            const response = await fetch(
                `${this.apiBaseUrl}/overrides/containers/${this.currentAgent.containerId}/agents/${this.currentAgent.agentId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                }
            );

            const result = await response.json();

            if (result.success) {
                this.showToast('success', 'Schedule updated', `Successfully updated schedule for ${this.currentAgent.agentId}`);
                this.closeModal();
                this.loadContainers(); // Refresh data
            } else {
                throw new Error(result.message || 'Failed to update schedule');
            }

        } catch (error) {
            console.error('Failed to update schedule:', error);
            this.showValidationError(error.message);
            this.showToast('error', 'Update failed', error.message);
        } finally {
            const saveBtn = document.getElementById('saveBtn');
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Schedule';
            saveBtn.disabled = false;
        }
    }

    getFormData() {
        return {
            workingHours: document.getElementById('workingHours').checked,
            startDateTime: this.toISOString(document.getElementById('startDateTime').value),
            endDateTime: this.toISOString(document.getElementById('endDateTime').value)
        };
    }

    validateFormData(data) {
        const errors = [];

        if (!data.startDateTime) {
            errors.push('Start date and time is required');
        }

        if (!data.endDateTime) {
            errors.push('End date and time is required');
        }

        if (data.startDateTime && data.endDateTime) {
            const start = new Date(data.startDateTime);
            const end = new Date(data.endDateTime);

            if (start >= end) {
                errors.push('End time must be after start time');
            }

            if (start < new Date()) {
                errors.push('Start time cannot be in the past');
            }
        }

        if (errors.length > 0) {
            this.showValidationErrors(errors);
            return false;
        }

        this.clearValidationErrors();
        return true;
    }

    validateForm() {
        const formData = this.getFormData();
        this.validateFormData(formData);
    }

    showValidationErrors(errors) {
        const container = document.getElementById('validationMessages');
        container.innerHTML = errors.map(error => 
            `<div class="validation-error">
                <i class="fas fa-exclamation-triangle"></i>
                ${this.escapeHtml(error)}
            </div>`
        ).join('');
    }

    showValidationError(error) {
        this.showValidationErrors([error]);
    }

    clearValidationErrors() {
        document.getElementById('validationMessages').innerHTML = '';
    }

    showLoadingState() {
        document.getElementById('loadingState').style.display = 'block';
        document.getElementById('errorState').style.display = 'none';
        document.getElementById('containersContent').style.display = 'none';
    }

    showErrorState(message) {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('errorState').style.display = 'block';
        document.getElementById('containersContent').style.display = 'none';
        document.getElementById('errorMessage').textContent = message;
    }

    showContent() {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('errorState').style.display = 'none';
        document.getElementById('containersContent').style.display = 'block';
    }

    showToast(type, title, message, duration = 5000) {
        const container = document.getElementById('toastContainer');
        const toastId = 'toast_' + Date.now();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.id = toastId;
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">
                    <i class="fas ${this.getToastIcon(type)}"></i>
                </div>
                <div class="toast-body">
                    <div class="toast-title">${this.escapeHtml(title)}</div>
                    <div class="toast-message">${this.escapeHtml(message)}</div>
                </div>
            </div>
            <button class="toast-close" onclick="app.closeToast('${toastId}')">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(toast);

        // Auto-close toast
        if (duration > 0) {
            setTimeout(() => {
                this.closeToast(toastId);
            }, duration);
        }
    }

    closeToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.style.animation = 'toastSlideIn 0.3s ease reverse';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }
    }

    getToastIcon(type) {
        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        return icons[type] || 'fa-info-circle';
    }

    formatDateTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    toLocalDateTimeString(isoString) {
        const date = new Date(isoString);
        return date.toISOString().slice(0, 16);
    }

    toISOString(localDateTimeString) {
        if (!localDateTimeString) return '';
        return new Date(localDateTimeString).toISOString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WxccAgentScheduler();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // ESC to close modal
    if (e.key === 'Escape') {
        const modal = document.getElementById('scheduleModal');
        if (modal.classList.contains('show')) {
            window.app.closeModal();
        }
    }
    
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('agentSearch').focus();
    }
    
    // F5 or Ctrl/Cmd + R to refresh (override default to use our refresh)
    if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
        e.preventDefault();
        window.app.loadContainers();
    }
});

// Handle browser back/forward
window.addEventListener('popstate', () => {
    // Close modal if it's open
    const modal = document.getElementById('scheduleModal');
    if (modal.classList.contains('show')) {
        window.app.closeModal();
    }
});