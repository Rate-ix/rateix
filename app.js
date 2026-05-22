document.addEventListener('DOMContentLoaded', () => {
    // 1. Navbar Scroll State Management
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 2. Mobile Menu Navigation Control
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileNav = document.querySelector('.mobile-nav');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link, .mobile-waitlist-btn');

    const toggleMobileMenu = () => {
        mobileMenuBtn.classList.toggle('active');
        mobileNav.classList.toggle('active');
        document.body.classList.toggle('no-scroll');
    };

    mobileMenuBtn.addEventListener('click', toggleMobileMenu);

    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mobileNav.classList.contains('active')) {
                toggleMobileMenu();
            }
        });
    });

    // 3. Scroll Entrance Animations (Intersection Observer)
    const animateElements = document.querySelectorAll('.fade-in, .animate-scroll');
    
    const observerOptions = {
        root: null,
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optional: Unobserve after animating in to preserve resources
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    animateElements.forEach(element => {
        observer.observe(element);
    });

    // 4. Live Simulated Dashboard Analytics & Movements
    const activeOrdersVal = document.querySelector('.mockup-stats-grid .mini-card:nth-child(1) .card-value');
    const lowStockAlertVal = document.querySelector('.mockup-stats-grid .mini-card:nth-child(3) .card-value');
    const deliveryTrackerText = document.querySelector('.live-delivery-tracker span');
    
    // Simulate stock shifts randomly
    setInterval(() => {
        // Subtle fluctuation in Active Orders
        if (activeOrdersVal) {
            let currentOrders = parseInt(activeOrdersVal.textContent);
            const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
            currentOrders = Math.max(110, Math.min(145, currentOrders + delta));
            activeOrdersVal.textContent = currentOrders;
        }

        // Randomly simulate a dispatch route updates
        if (deliveryTrackerText) {
            const drivers = ['Tempo TS-04', 'Carrier DL-09', 'Chota Hathi MH-12', 'Mini Truck UP-16'];
            const areas = ['West Chowk Godown', 'Gole Market Hub', 'Main Bazar Retailer', 'Noida Wholesale Mandi'];
            const statuses = ['dispatched to', 'arriving at', 'unloading at', 'route calculated to'];
            
            const randomDriver = drivers[Math.floor(Math.random() * drivers.length)];
            const randomArea = areas[Math.floor(Math.random() * areas.length)];
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            
            deliveryTrackerText.textContent = `${randomDriver} ${randomStatus} ${randomArea}`;
        }
    }, 6000);

    // 5. Waitlist Registration Form Validation & Feedback Toast
    const waitlistForm = document.getElementById('waitlistForm');
    const waitlistEmail = document.getElementById('waitlistEmail');
    const formFeedback = document.getElementById('formFeedback');
    const toast = document.getElementById('toast');

    if (waitlistForm) {
        waitlistForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = waitlistEmail.value.trim();

            // Perform simple validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showFeedback('Please enter a valid business email address.', 'error');
                return;
            }

            // Simulate server network loading state
            const submitBtn = waitlistForm.querySelector('.btn-submit');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Registering...</span>';

            setTimeout(() => {
                // Success Scenario Simulation
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                
                // Show local success states
                waitlistEmail.value = '';
                showFeedback('Success! Thank you for joining the waitlist.', 'success');
                launchToast();
                
                // Reset form feedback state after 5 seconds
                setTimeout(() => {
                    formFeedback.textContent = '';
                    formFeedback.className = 'form-feedback';
                }, 5000);

            }, 1200);
        });
    }

    function showFeedback(message, type) {
        formFeedback.textContent = message;
        formFeedback.className = `form-feedback ${type}`;
    }

    function launchToast() {
        toast.classList.add('active');
        setTimeout(() => {
            toast.classList.remove('active');
        }, 5000);
    }
});
