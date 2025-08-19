// Global variables
let servicesData = null;
let selectedServices = [];
let currentAudience = 'all';
let bookingDetails = null; // Store booking details before confirmation

// DOM elements
const servicesGrid = document.getElementById('servicesGrid');
const audienceTabs = document.querySelectorAll('.audience-tab');

// Initialize the application
async function initializeApp() {
    try {
        await loadServices();
        renderServices();
        createFloatingBottomBar();
        createRightSidebar();
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Failed to load services. Please refresh the page.');
    }
}

// Load services from the API
async function loadServices() {
    try {
        const response = await fetch('/api/services');
        if (!response.ok) {
            throw new Error('Failed to fetch services');
        }
        servicesData = await response.json();
    } catch (error) {
        console.error('Error loading services:', error);
        throw error;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Audience tab clicks
    audienceTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const audience = tab.dataset.audience;
            setActiveAudience(audience);
        });
    });
}

// Set active audience and filter services
function setActiveAudience(audience) {
    currentAudience = audience;
    
    // Update active tab
    audienceTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.audience === audience);
    });
    
    // Re-render services
    renderServices();
}

// Render services based on current audience filter
function renderServices() {
    if (!servicesData || !servicesGrid) return;
    
    const allServices = getAllServices();
    const filteredServices = filterServicesByAudience(allServices, currentAudience);
    
    servicesGrid.innerHTML = '';
    
    if (filteredServices.length === 0) {
        servicesGrid.innerHTML = `
            <div class="no-services">
                <p>No services available for the selected category.</p>
            </div>
        `;
        return;
    }
    
    filteredServices.forEach(service => {
        const serviceCard = createServiceCard(service);
        servicesGrid.appendChild(serviceCard);
    });
}

// Get all services from the data structure
function getAllServices() {
    if (!servicesData) return [];
    
    const allServices = [];
    
    Object.values(servicesData.services).forEach(category => {
        category.services.forEach(service => {
            allServices.push({
                ...service,
                categoryName: category.category_name,
                categoryDescription: category.description
            });
        });
    });

    return allServices;
}

// Filter services by audience
function filterServicesByAudience(services, audience) {
    if (audience === 'all') {
        return services;
    }
    
    return services.filter(service => {
        if (service.target_audience) {
            return service.target_audience === audience;
        }
        return audience === 'all';
    });
}

// Create a service card element
function createServiceCard(service) {
    const card = document.createElement('div');
    card.className = 'service-card';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Select ${service.name}`);
    
    card.innerHTML = `
        <div class="service-header">
            <h3 class="service-name">${service.name}</h3>
            <div class="service-price">$${service.price}</div>
        </div>
        <div class="service-meta">
            <span class="service-duration">${service.duration}</span>
            <span class="service-category">${service.categoryName}</span>
        </div>
        <div class="service-actions">
            <button class="view-details-btn" onclick="showServiceDetailsModal('${service.name.replace(/'/g, "\\'")}')">View Details</button>
            <button class="select-service-btn" onclick="selectService('${service.name.replace(/'/g, "\\'")}')">Select Service</button>
        </div>
    `;
    
    // Add keyboard navigation
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectService(service.name);
        }
    });
    
    return card;
}

// Create floating bottom bar
function createFloatingBottomBar() {
    const bottomBar = document.createElement('div');
    bottomBar.className = 'floating-bottom-bar';
    bottomBar.innerHTML = `
        <div class="service-counter" onclick="openBookingSidebar()">
            <div class="nail-icon">
                <i class="fas fa-calendar-check"></i>
            </div>
            <div class="counter-badge" id="serviceCountBadge">0</div>
        </div>
    `;
    
    document.body.appendChild(bottomBar);
}

// Create right sidebar
function createRightSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'booking-sidebar';
    sidebar.id = 'bookingSidebar';
    sidebar.innerHTML = `
        <div class="sidebar-overlay" onclick="closeBookingSidebar()"></div>
        <div class="sidebar-content">
            <div class="sidebar-header">
                <h3>Your Booking</h3>
                <button class="close-sidebar" onclick="closeBookingSidebar()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="sidebar-body" id="sidebarBody">
                <!-- Content will be dynamically inserted here -->
            </div>
        </div>
    `;
    
    document.body.appendChild(sidebar);
}

// Select a service with fly-to-cart animation
function selectService(serviceName) {
    const allServices = getAllServices();
    const service = allServices.find(s => s.name === serviceName);
    
    if (!service) return;
    
    // Add service to selected services
    selectedServices.push(service);
    
    // Create fly-to-cart animation
    createFlyToCartAnimation(service);
    
    // Update counter badge
    updateServiceCounter();
}

// Create fly-to-cart animation
function createFlyToCartAnimation(service) {
    // Find the service card that was clicked
    const serviceCard = Array.from(document.querySelectorAll('.service-card')).find(card => {
        const nameEl = card.querySelector('.service-name');
        return nameEl && nameEl.textContent === service.name;
    });
    
    if (!serviceCard) return;
    
    // Create flying number element
    const flyingNumber = document.createElement('div');
    flyingNumber.className = 'flying-number';
    flyingNumber.textContent = selectedServices.length;
    
    // Get positions
    const cardRect = serviceCard.getBoundingClientRect();
    const bottomBar = document.querySelector('.floating-bottom-bar');
    const bottomBarRect = bottomBar.getBoundingClientRect();
    
    // Set initial position
    flyingNumber.style.position = 'fixed';
    flyingNumber.style.left = cardRect.left + cardRect.width / 2 + 'px';
    flyingNumber.style.top = cardRect.top + cardRect.height / 2 + 'px';
    flyingNumber.style.zIndex = '9999';
    
    document.body.appendChild(flyingNumber);
    
    // Animate to bottom bar
    setTimeout(() => {
        flyingNumber.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        flyingNumber.style.left = bottomBarRect.left + bottomBarRect.width / 2 + 'px';
        flyingNumber.style.top = bottomBarRect.top + bottomBarRect.height / 2 + 'px';
        flyingNumber.style.opacity = '0';
        flyingNumber.style.transform = 'scale(0.5)';
    }, 50);
    
    // Remove element after animation
    setTimeout(() => {
        if (flyingNumber.parentNode) {
            flyingNumber.parentNode.removeChild(flyingNumber);
        }
    }, 900);
}

// Update service counter badge
function updateServiceCounter() {
    const badge = document.getElementById('serviceCountBadge');
    const bottomBar = document.querySelector('.floating-bottom-bar');
    
    if (selectedServices.length > 0) {
        badge.textContent = selectedServices.length;
        badge.style.display = 'flex';
        bottomBar.classList.add('has-services');
    } else {
        badge.style.display = 'none';
        bottomBar.classList.remove('has-services');
    }
}

// Open booking sidebar
function openBookingSidebar() {
    if (selectedServices.length === 0) return;
    
    const sidebar = document.getElementById('bookingSidebar');
    const sidebarBody = document.getElementById('sidebarBody');
    
    // Show selected services
    renderSelectedServices(sidebarBody);
    
    sidebar.classList.add('open');
    document.body.classList.add('sidebar-open');
}

// Close booking sidebar
function closeBookingSidebar() {
    const sidebar = document.getElementById('bookingSidebar');
    sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
}

// Render selected services in sidebar
function renderSelectedServices(container) {
    if (selectedServices.length === 0) {
        container.innerHTML = '<p>No services selected</p>';
            return;
        }
    
    if (selectedServices.length === 1) {
        // Single service - show day/time selection
        renderSingleServiceBooking(container);
    } else {
        // Multiple services - show options
        renderMultipleServicesOptions(container);
    }
}

// Render multiple services options
function renderMultipleServicesOptions(container) {
    const totalPrice = selectedServices.reduce((sum, service) => sum + parseFloat(service.price), 0);
    const totalDuration = selectedServices.reduce((sum, service) => sum + parseInt(service.duration), 0);
    
    container.innerHTML = `
        <div class="services-list">
            <h5>Selected Services (${selectedServices.length})</h5>
            ${selectedServices.map((service, index) => `
                <div class="selected-service">
                    <div class="service-info">
                        <h6>${service.name}</h6>
                        <p class="service-meta">$${service.price} • ${service.duration}</p>
                    </div>
                    <button class="remove-service" onclick="removeService(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            `).join('')}
                    </div>
        
        <div class="services-summary">
            <div class="summary-item">
                <span>Total Price:</span>
                <span class="total-price">$${totalPrice}</span>
                    </div>
            <div class="summary-item">
                <span>Total Duration:</span>
                <span>${totalDuration} min</span>
                    </div>
                </div>
        
        <div class="booking-options">
            <h5>How would you like to schedule these services?</h5>
            <div class="option-buttons">
                <button class="option-btn" onclick="scheduleBackToBack()">
                    <i class="fas fa-clock"></i>
                    <div>
                        <span>Back-to-back</span>
                        <small>Same day, consecutive times</small>
                </div>
                </button>
                <button class="option-btn" onclick="scheduleIndividually()">
                    <i class="fas fa-calendar-alt"></i>
                    <div>
                        <span>Individual scheduling</span>
                        <small>Choose different days/times</small>
            </div>
                </button>
            </div>
        </div>
    `;
}

// Render single service booking
function renderSingleServiceBooking(container) {
    const service = selectedServices[0];
    
    container.innerHTML = `
        <div class="selected-service">
            <div class="service-info">
                <h4>${service.name}</h4>
                <p class="service-price">$${service.price}</p>
                <p class="service-duration">${service.duration}</p>
            </div>
            <button class="remove-service" onclick="removeService(0)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        
        <div class="booking-section">
            <h5>Select Date & Time</h5>
            <div class="form-group">
                <label for="bookingDate">Date</label>
                <input type="date" id="bookingDate" onchange="loadTimeSlots()" />
                    </div>
            <div class="form-group">
                <label for="bookingTime">Time</label>
                <select id="bookingTime">
                    <option value="">Select a time...</option>
                </select>
                </div>
                
            <div class="booking-actions">
                <button class="btn-secondary" onclick="askForMoreServices()">Add More Services</button>
                <button class="btn-primary" onclick="proceedToConfirmation()" disabled id="proceedBtn">Continue</button>
            </div>
        </div>
    `;
    
    // Set minimum date to today
    const dateInput = document.getElementById('bookingDate');
    const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
        dateInput.value = today;
    
    console.log('Date input set to:', dateInput.value);
    
    // Load initial time slots
    loadTimeSlots();
    
    // Setup form validation (with slight delay to ensure DOM is ready)
    setTimeout(() => {
        setupFormValidation();
    }, 100);
}

// Ask for more services - close sidebar and let user continue selecting
function askForMoreServices() {
    // Close the sidebar to let user continue selecting services
    closeBookingSidebar();
    
    // Scroll to services section
    const servicesSection = document.getElementById('services');
    if (servicesSection) {
        servicesSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
    
    // Optional: Show a brief message or highlight that they can continue selecting
    showTemporaryMessage('Continue selecting more services below');
}

// Show a temporary message to guide the user
function showTemporaryMessage(message) {
    // Remove any existing message
    const existingMessage = document.querySelector('.temporary-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'temporary-message';
    messageDiv.innerHTML = `
        <div class="message-content">
            <i class="fas fa-info-circle"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Insert after services section title
    const servicesSection = document.getElementById('services');
    const sectionTitle = servicesSection.querySelector('.section-title');
    if (sectionTitle) {
        sectionTitle.insertAdjacentElement('afterend', messageDiv);
    }
    
    // Remove message after 3 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}

// Schedule services back-to-back
function scheduleBackToBack() {
    const container = document.getElementById('sidebarBody');
    const totalDuration = selectedServices.reduce((sum, service) => sum + parseInt(service.duration), 0);
    
    container.innerHTML = `
        <div class="back-button">
            <button onclick="renderSelectedServices(document.getElementById('sidebarBody'))">
                <i class="fas fa-arrow-left"></i> Back
                </button>
            </div>
        
        <div class="services-summary">
            <h5>Back-to-back Booking</h5>
                         <div class="services-list">
                ${selectedServices.map((service, index) => `
                    <div class="service-schedule-item">
                        <span class="service-order">${index + 1}.</span>
                                     <span class="service-name">${service.name}</span>
                        <span class="service-duration">${service.duration}</span>
                                 </div>
                             `).join('')}
                         </div>
            <div class="total-info">
                <p><strong>Total Duration: ${totalDuration} minutes</strong></p>
                    </div>
                </div>
                
        <div class="booking-section">
            <h5>Select Date & Time for All Services</h5>
                    <div class="form-group">
                <label for="backToBackDate">Date</label>
                <input type="date" id="backToBackDate" onchange="loadBackToBackTimeSlots()" />
                    </div>
                    <div class="form-group">
                <label for="backToBackTime">Start Time</label>
                <select id="backToBackTime">
                    <option value="">Select start time...</option>
                </select>
                    </div>
                    
            <div class="booking-actions">
                <button class="btn-primary" onclick="proceedToConfirmation()" disabled id="proceedBackToBackBtn">Continue</button>
            </div>
        </div>
    `;
    
    // Set minimum date to today
    const dateInput = document.getElementById('backToBackDate');
    const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
        dateInput.value = today;
    
    // Load time slots
    loadBackToBackTimeSlots();
    
    // Setup validation
    setupBackToBackValidation();
}

// Schedule services individually
function scheduleIndividually() {
    const container = document.getElementById('sidebarBody');
    
    container.innerHTML = `
        <div class="back-button">
            <button onclick="renderSelectedServices(document.getElementById('sidebarBody'))">
                <i class="fas fa-arrow-left"></i> Back
                </button>
                </div>
                
        <div class="individual-scheduling">
            <h5>Schedule Each Service</h5>
            <div class="services-to-schedule">
                ${selectedServices.map((service, index) => `
                    <div class="service-schedule-card">
                        <div class="service-header">
                            <h6>${service.name}</h6>
                            <p class="service-meta">$${service.price} • ${service.duration}</p>
                    </div>
                        <div class="schedule-form">
                    <div class="form-group">
                                <label for="date_${index}">Date</label>
                                <input type="date" id="date_${index}" data-index="${index}" onchange="loadIndividualTimeSlots(${index})" />
                    </div>
                    <div class="form-group">
                                <label for="time_${index}">Time</label>
                                <select id="time_${index}" data-index="${index}" onchange="validateIndividualScheduling()">
                                    <option value="">Select time...</option>
                            </select>
                        </div>
                    </div>
            </div>
                `).join('')}
            </div>
            
            <div class="booking-actions">
                <button class="btn-primary" onclick="proceedToConfirmation()" disabled id="proceedIndividualBtn">Continue</button>
            </div>
        </div>
    `;
    
    // Set minimum dates and load initial slots
    const today = new Date().toISOString().split('T')[0];
    selectedServices.forEach((service, index) => {
        const dateInput = document.getElementById(`date_${index}`);
        dateInput.min = today;
        dateInput.value = today;
        loadIndividualTimeSlots(index);
    });
    
    validateIndividualScheduling();
}

// Proceed to confirmation
function proceedToConfirmation() {
    console.log('📋 Proceeding to confirmation step...');
    
    // FIRST: Store booking details before switching screens
    try {
        if (selectedServices.length === 1) {
            // Single service booking
            const date = document.getElementById('bookingDate')?.value;
            const time = document.getElementById('bookingTime')?.value;
            
            if (!date || !time) {
                console.error('Missing date or time for single service booking');
                alert('Please select both date and time before proceeding.');
                return;
            }
            
            bookingDetails = {
                type: 'single',
                date,
                time,
                services: selectedServices
            };
            
        } else {
            // Multiple services - check if back-to-back or individual
            const backToBackDate = document.getElementById('backToBackDate');
            
            if (backToBackDate && backToBackDate.value) {
                // Back-to-back booking
                const date = backToBackDate.value;
                const time = document.getElementById('backToBackTime')?.value;
                
                if (!date || !time) {
                    console.error('Missing date or time for back-to-back booking');
                    alert('Please select both date and time before proceeding.');
                    return;
                }
                
                bookingDetails = {
                    type: 'back_to_back',
                    date,
                    time,
                    services: selectedServices
                };
                
            } else {
                // Individual scheduling
                const individualBookings = [];
                let hasError = false;
                
                selectedServices.forEach((service, index) => {
                    const date = document.getElementById(`date_${index}`)?.value;
                    const time = document.getElementById(`time_${index}`)?.value;
                    
                    if (!date || !time) {
                        console.error(`Missing date or time for service ${index}: ${service.name}`);
                        hasError = true;
                        return;
                    }
                    
                    individualBookings.push({
                        service,
                        date,
                        time
                    });
                });
                
                if (hasError) {
                    alert('Please select date and time for all services before proceeding.');
                    return;
                }
                
                bookingDetails = {
                    type: 'individual',
                    individualBookings,
                    services: selectedServices
                };
            }
        }
        
        console.log('Booking details stored:', bookingDetails);
        
    } catch (error) {
        console.error('Error storing booking details:', error);
        alert('Error processing booking details. Please try again.');
        return;
    }
    
    // THEN: Switch to confirmation screen
    const container = document.getElementById('sidebarBody');
    
    container.innerHTML = `
        <div class="confirmation-section">
            <div class="booking-summary">
                <h5>Booking Summary</h5>
                ${generateBookingSummary()}
                </div>
            
            <div class="contact-form">
                <h5>Contact Information</h5>
                <div class="form-group">
                    <label for="confirmCustomerName">Full Name *</label>
                    <input type="text" id="confirmCustomerName" required />
        </div>
                <div class="form-group">
                    <label for="confirmCustomerPhone">Phone Number *</label>
                    <input type="tel" id="confirmCustomerPhone" required />
            </div>
                <div class="form-group">
                    <label for="confirmCustomerEmail">Email Address *</label>
                    <input type="email" id="confirmCustomerEmail" required />
        </div>
        
                <div class="booking-actions">
                    <button class="btn-secondary" onclick="goBack()">Back</button>
                    <button class="btn-primary" onclick="confirmBooking()" disabled id="confirmBtn">Confirm Booking</button>
            </div>
            </div>
        </div>
    `;
    
    setupConfirmationValidation();
}

// Generate booking summary
function generateBookingSummary() {
    const totalPrice = selectedServices.reduce((sum, service) => sum + parseFloat(service.price), 0);
    
    return `
        <div class="services-summary">
            ${selectedServices.map((service, index) => `
                <div class="summary-service">
                    <span class="service-name">${service.name}</span>
                    <span class="service-price">$${service.price}</span>
            </div>
            `).join('')}
            <div class="total-line">
                <span><strong>Total: $${totalPrice}</strong></span>
            </div>
        </div>
    `;
}

// Remove service from selection
function removeService(index) {
    selectedServices.splice(index, 1);
    updateServiceCounter();
    
    if (selectedServices.length === 0) {
        closeBookingSidebar();
    } else {
        renderSelectedServices(document.getElementById('sidebarBody'));
    }
}

// Load time slots (placeholder functions)
async function loadTimeSlots() {
    const timeSelect = document.getElementById('bookingTime');
    const date = document.getElementById('bookingDate').value;
    
    if (!date) {
        timeSelect.innerHTML = '<option value="">Select a date first...</option>';
        return;
    }
    
    try {
    // Show loading state
        timeSelect.innerHTML = '<option value="">Loading available times...</option>';
        
        // Call the API to get available slots
        const response = await fetch(`/api/slots/${date}`);
        const data = await response.json();
        
        if (response.ok && data.availableSlots) {
            timeSelect.innerHTML = '<option value="">Select a time...</option>';
            
            if (data.availableSlots.length === 0) {
                timeSelect.innerHTML = '<option value="">No available times for this date</option>';
            } else {
                                data.availableSlots.forEach(slot => {
                    const option = document.createElement('option');
                    option.value = slot;
                    option.textContent = slot;
                    timeSelect.appendChild(option);
                });
            }
            
            // Trigger validation after loading slots
            console.log('Time slots loaded, triggering validation...');
            const event = new Event('change');
            timeSelect.dispatchEvent(event);
            
            // Also try to run validation manually
            const proceedBtn = document.getElementById('proceedBtn');
            if (proceedBtn) {
                console.log('Found proceed button, checking if we can enable it...');
                const dateInput = document.getElementById('bookingDate');
                if (dateInput && dateInput.value) {
                    console.log('Date is set, button should be enabled when time is selected');
                }
            }
        } else {
            timeSelect.innerHTML = '<option value="">Error loading times</option>';
            console.error('Error loading time slots:', data.error || 'Unknown error');
        }
    } catch (error) {
        timeSelect.innerHTML = '<option value="">Error loading times</option>';
        console.error('Error loading time slots:', error);
    }
}

async function loadBackToBackTimeSlots() {
    const timeSelect = document.getElementById('backToBackTime');
    const date = document.getElementById('backToBackDate').value;
    
    if (!date) {
        timeSelect.innerHTML = '<option value="">Select a date first...</option>';
            return;
    }
    
    try {
        timeSelect.innerHTML = '<option value="">Loading available times...</option>';
        
        const response = await fetch(`/api/slots/${date}`);
        const data = await response.json();
        
        if (response.ok && data.availableSlots) {
            timeSelect.innerHTML = '<option value="">Select start time...</option>';
            
            if (data.availableSlots.length === 0) {
                timeSelect.innerHTML = '<option value="">No available times for this date</option>';
            } else {
                data.availableSlots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot;
        option.textContent = slot;
                    timeSelect.appendChild(option);
                });
            }
        } else {
            timeSelect.innerHTML = '<option value="">Error loading times</option>';
        }
    } catch (error) {
        timeSelect.innerHTML = '<option value="">Error loading times</option>';
        console.error('Error loading back-to-back time slots:', error);
    }
}

async function loadIndividualTimeSlots(index) {
    // Load time slots for individual service scheduling
    const timeSelect = document.getElementById(`time_${index}`);
    const date = document.getElementById(`date_${index}`).value;
    
    if (!date) {
        timeSelect.innerHTML = '<option value="">Select a date first...</option>';
        return;
    }
    
    try {
        timeSelect.innerHTML = '<option value="">Loading available times...</option>';
        
        const response = await fetch(`/api/slots/${date}`);
        const data = await response.json();
        
        if (response.ok && data.availableSlots) {
            timeSelect.innerHTML = '<option value="">Select time...</option>';
            
            if (data.availableSlots.length === 0) {
                timeSelect.innerHTML = '<option value="">No available times for this date</option>';
        } else {
                data.availableSlots.forEach(slot => {
                    const option = document.createElement('option');
                    option.value = slot;
                    option.textContent = slot;
                    timeSelect.appendChild(option);
                });
            }
        } else {
            timeSelect.innerHTML = '<option value="">Error loading times</option>';
        }
    } catch (error) {
        timeSelect.innerHTML = '<option value="">Error loading times</option>';
        console.error('Error loading individual time slots:', error);
    }
}

// Validation functions
function setupFormValidation() {
    console.log('Setting up form validation...');
    
    const dateInput = document.getElementById('bookingDate');
    const timeSelect = document.getElementById('bookingTime');
    const proceedBtn = document.getElementById('proceedBtn');
    
    console.log('Form elements found:', { 
        dateInput: !!dateInput, 
        timeSelect: !!timeSelect, 
        proceedBtn: !!proceedBtn 
    });
    
    if (!dateInput || !timeSelect || !proceedBtn) {
        console.error('Missing form elements for validation');
        return;
    }
    
    function validate() {
        const hasDate = !!dateInput.value;
        const hasTime = !!timeSelect.value;
        const isValid = hasDate && hasTime;
        
        console.log('Single service validation:', { 
            date: dateInput.value, 
            time: timeSelect.value, 
            hasDate,
            hasTime,
            isValid,
            buttonDisabled: proceedBtn.disabled
        });
        
        proceedBtn.disabled = !isValid;
        
        // Force visual update
        if (isValid) {
            proceedBtn.removeAttribute('disabled');
            proceedBtn.style.opacity = '1';
            proceedBtn.style.pointerEvents = 'auto';
    } else {
            proceedBtn.setAttribute('disabled', 'disabled');
            proceedBtn.style.opacity = '0.5';
            proceedBtn.style.pointerEvents = 'none';
        }
        
        console.log('Button disabled set to:', proceedBtn.disabled);
        console.log('Button classes:', proceedBtn.className);
        console.log('Button style:', proceedBtn.style.cssText);
    }
    
    dateInput.addEventListener('change', validate);
    timeSelect.addEventListener('change', validate);
    
    // Also add input event listeners for real-time validation
    dateInput.addEventListener('input', validate);
    timeSelect.addEventListener('input', validate);
    
    // Run initial validation
    validate();
    

}

function setupBackToBackValidation() {
    const dateInput = document.getElementById('backToBackDate');
    const timeSelect = document.getElementById('backToBackTime');
    const proceedBtn = document.getElementById('proceedBackToBackBtn');
    
    function validate() {
        const isValid = dateInput.value && timeSelect.value;
        console.log('Back-to-back validation:', { date: dateInput.value, time: timeSelect.value, isValid });
        proceedBtn.disabled = !isValid;
    }
    
    dateInput.addEventListener('change', validate);
    timeSelect.addEventListener('change', validate);
    
    // Run initial validation
    validate();
}

function validateIndividualScheduling() {
    const proceedBtn = document.getElementById('proceedIndividualBtn');
    let allValid = true;
    const validationData = [];
    
    selectedServices.forEach((service, index) => {
        const date = document.getElementById(`date_${index}`).value;
        const time = document.getElementById(`time_${index}`).value;
        validationData.push({ service: service.name, date, time });
        if (!date || !time) {
            allValid = false;
        }
    });
    
    console.log('Individual scheduling validation:', { validationData, allValid });
    proceedBtn.disabled = !allValid;
}

function setupConfirmationValidation() {
    console.log('Setting up confirmation validation...');
    
    setTimeout(() => {
        const confirmBtn = document.getElementById('confirmBtn');
        const nameInput = document.getElementById('confirmCustomerName');
        const phoneInput = document.getElementById('confirmCustomerPhone');
        const emailInput = document.getElementById('confirmCustomerEmail');
        
        if (confirmBtn && nameInput && phoneInput && emailInput) {
            console.log('Confirmation form elements found, setting up validation');
            
            function validateConfirmationForm() {
                const nameValue = nameInput.value.trim();
                const phoneValue = phoneInput.value.trim();
                const emailValue = emailInput.value.trim();
                
                const hasName = nameValue.length > 0;
                const hasPhone = phoneValue.length > 0;
                const hasEmail = emailValue.length > 0 && emailValue.includes('@');
                
                const isValid = hasName && hasPhone && hasEmail;
                
                console.log('Confirmation validation:', { 
                    name: nameValue, 
                    phone: phoneValue, 
                    email: emailValue,
                    hasName, hasPhone, hasEmail, isValid 
                });
                
                // Always enable the button - let the confirmBooking function handle validation
                confirmBtn.disabled = false;
                confirmBtn.removeAttribute('disabled');
                confirmBtn.style.opacity = '1';
                confirmBtn.style.pointerEvents = 'auto';
                confirmBtn.style.cursor = 'pointer';
                
                // Visual feedback for form completeness (optional styling)
                if (isValid) {
                    confirmBtn.classList.remove('incomplete');
                    confirmBtn.classList.add('complete');
                } else {
                    confirmBtn.classList.remove('complete');
                    confirmBtn.classList.add('incomplete');
                }
            }
            
            // Add event listeners for real-time validation
            nameInput.addEventListener('input', validateConfirmationForm);
            nameInput.addEventListener('change', validateConfirmationForm);
            nameInput.addEventListener('blur', validateConfirmationForm);
            
            phoneInput.addEventListener('input', validateConfirmationForm);
            phoneInput.addEventListener('change', validateConfirmationForm);
            phoneInput.addEventListener('blur', validateConfirmationForm);
            
            emailInput.addEventListener('input', validateConfirmationForm);
            emailInput.addEventListener('change', validateConfirmationForm);
            emailInput.addEventListener('blur', validateConfirmationForm);
            
            // Initial validation
            validateConfirmationForm();
            
            console.log('Confirmation validation setup complete');
        } else {
            console.error('Confirmation form elements not found:', {
                confirmBtn: !!confirmBtn,
                nameInput: !!nameInput,
                phoneInput: !!phoneInput,
                emailInput: !!emailInput
            });
        }
    }, 100);
}

// Utility functions
function goBack() {
    renderSelectedServices(document.getElementById('sidebarBody'));
}



async function confirmBooking() {
    console.log('🎉 confirmBooking() function called!');
    
    const confirmBtn = document.getElementById('confirmBtn');
    if (!confirmBtn) {
        console.error('❌ Confirm button not found!');
        return;
    }
    
    const originalText = confirmBtn.textContent;
    console.log('📋 Starting booking confirmation process...');
    
    try {
        // Show loading state
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Confirming...';
        
        // Get customer details
        const nameInput = document.getElementById('confirmCustomerName');
        const phoneInput = document.getElementById('confirmCustomerPhone');
        const emailInput = document.getElementById('confirmCustomerEmail');
        
        console.log('Customer form elements:', {
            nameInput: nameInput ? 'FOUND' : 'NOT FOUND',
            phoneInput: phoneInput ? 'FOUND' : 'NOT FOUND',
            emailInput: emailInput ? 'FOUND' : 'NOT FOUND'
        });
        
        if (!nameInput || !phoneInput || !emailInput) {
            throw new Error('Customer form fields not found. Please refresh and try again.');
        }
        
        // Get values directly from the form inputs
        const customerName = nameInput.value.trim();
        const customerPhone = phoneInput.value.trim();
        const customerEmail = emailInput.value.trim();
        
        console.log('Customer details retrieved:', {
            customerName: `"${customerName}"`,
            customerPhone: `"${customerPhone}"`,
            customerEmail: `"${customerEmail}"`
        });
        
        // Validate customer details
        if (!customerName || !customerPhone || !customerEmail) {
            // Show a more helpful error message
            const missingFields = [];
            if (!customerName) missingFields.push('Name');
            if (!customerPhone) missingFields.push('Phone');
            if (!customerEmail) missingFields.push('Email');
            
            throw new Error(`Please fill in the following fields: ${missingFields.join(', ')}. If you used autofill, please click in each field and press Tab to ensure the values are saved. Or try: populateCustomerForm() in console.`);
        }
        
        if (!customerEmail.includes('@') || !customerEmail.includes('.')) {
            throw new Error('Please enter a valid email address.');
        }
        
        // Check if we have stored booking details
        if (!bookingDetails) {
            throw new Error('No booking details found. Please go back and select date/time.');
        }
        
        console.log('Using stored booking details:', bookingDetails);
        
        // Build booking data from stored details
        let bookingData;
        
        if (bookingDetails.type === 'single') {
            // Single service booking
            bookingData = {
                customerName,
                customerPhone,
                customerEmail,
                date: bookingDetails.date,
                time: bookingDetails.time,
                serviceName: selectedServices[0].name,
                price: parseFloat(selectedServices[0].price),
                duration: parseInt(selectedServices[0].duration) || 30,
                targetAudience: selectedServices[0].audience || 'General',
                multipleServices: false,
                services: selectedServices,
                bookingType: 'single'
            };
            
        } else if (bookingDetails.type === 'back_to_back') {
            // Back-to-back booking
            const totalPrice = selectedServices.reduce((sum, service) => sum + parseFloat(service.price), 0);
            const totalDuration = selectedServices.reduce((sum, service) => sum + (parseInt(service.duration) || 30), 0);
            
            bookingData = {
                customerName,
                customerPhone,
                customerEmail,
                date: bookingDetails.date,
                time: bookingDetails.time,
                serviceName: selectedServices.map(s => s.name).join(', '),
                price: totalPrice,
                duration: totalDuration,
                targetAudience: selectedServices[0].audience || 'General',
                multipleServices: true,
                services: selectedServices,
                bookingType: 'back_to_back'
            };
            
        } else if (bookingDetails.type === 'individual') {
            // Individual scheduling - use first service for main booking
            const firstService = selectedServices[0];
            const firstBooking = bookingDetails.individualBookings[0];
            const totalPrice = selectedServices.reduce((sum, service) => sum + parseFloat(service.price), 0);
            
            // Prepare individual services data
            const individualServices = bookingDetails.individualBookings.map(booking => ({
                name: booking.service.name,
                price: parseFloat(booking.service.price),
                duration: parseInt(booking.service.duration) || 30,
                date: booking.date,
                time: booking.time
            }));
            
            bookingData = {
                customerName,
                customerPhone,
                customerEmail,
                date: firstBooking.date,
                time: firstBooking.time,
                serviceName: selectedServices.map(s => s.name).join(', '),
                price: totalPrice,
                duration: parseInt(firstService.duration) || 30,
                targetAudience: firstService.audience,
                multipleServices: true,
                services: selectedServices,
                bookingType: 'individual',
                individualServices
            };
        } else {
            throw new Error('Invalid booking type: ' + bookingDetails.type);
        }
        
        console.log('Submitting booking:', bookingData);
        
        // Submit booking to API
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bookingData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Success - show success modal
            showSuccessModal(result.booking);
            
            // Reset form
            selectedServices = [];
            bookingDetails = null; // Clear stored booking details
            updateServiceCounter();
            closeBookingSidebar();
        } else {
            // Error
            throw new Error(result.error || 'Failed to create booking');
        }
        
    } catch (error) {
        console.error('Error confirming booking:', error);
        showErrorModal(error.message);
    } finally {
        // Restore button state
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
    }
}

function showServiceDetailsModal(serviceName) {
    console.log('Show details for:', serviceName);

}

function showError(message) {
    console.error(message);
    alert(message);
}



// Modal functions
function closeModal() {
    console.log('Closing modal...');
    
    // Hide all modals
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
    
    // Remove modal-open class from body
    document.body.classList.remove('modal-open');
}

function showModal(modalId) {
    console.log('Showing modal:', modalId);
    
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
    } else {
        console.error('Modal not found:', modalId);
    }
}

function showSuccessModal(booking) {
    console.log('Showing success modal for booking:', booking);
    
    // Update the booking summary in the success modal
    const bookingSummary = document.getElementById('bookingSummary');
    if (bookingSummary && booking) {
        const totalPrice = selectedServices.reduce((sum, service) => sum + parseFloat(service.price), 0);
        bookingSummary.innerHTML = `
            <div class="booking-details">
                <h4>Booking Details</h4>
                <div class="detail-row">
                    <span>Booking ID:</span>
                    <span><strong>${booking.id}</strong></span>
                </div>
                <div class="detail-row">
                    <span>Date & Time:</span>
                    <span><strong>${booking.date} at ${booking.time}</strong></span>
                </div>
                <div class="detail-row">
                    <span>Service(s):</span>
                    <span><strong>${selectedServices.map(s => s.name).join(', ')}</strong></span>
                </div>
                <div class="detail-row">
                    <span>Total:</span>
                    <span><strong>$${totalPrice}</strong></span>
                </div>
                <div class="detail-row">
                    <span>Customer:</span>
                    <span><strong>${booking.customerName}</strong></span>
                </div>
            </div>
        `;
    }
    
    showModal('successModal');
}

function showErrorModal(errorMessage) {
    console.log('Showing error modal:', errorMessage);
    
    const errorMessageEl = document.getElementById('errorMessage');
    if (errorMessageEl) {
        errorMessageEl.textContent = errorMessage || 'An error occurred while processing your booking. Please try again.';
    }
    
    showModal('errorModal');
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});
