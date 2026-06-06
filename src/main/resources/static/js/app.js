// Aura Student Mental Wellness Tracker Client App (Phase 3 Expanded)
document.addEventListener('DOMContentLoaded', () => {
    // Current application state
    const state = {
        currentUser: null,
        currentExam: null,
        activeView: 'auth',
        previousView: 'dashboard',
        chartInstance: null,
        breathingTimer: null,
        breathingState: 0, 
        breathingSeconds: 0,
        pomodoroTimeLeft: 1500, // 25 mins
        pomodoroTimer: null,
        pomodoroIsRunning: false,
        pomodoroPhase: 'focus',
        
        // Phase 2: Grounding and Audio Synthesizer state
        groundingStage: 0,
        audioContext: null,
        audioSource: null,
        audioGainNode: null,
        audioOscillator: null,
        gratitudePrompts: [
            "💡 Gratitude Prompt: Write down one small win you achieved in your study session today.",
            "💡 Reflection Prompt: Name one topic you understood today and feel good about.",
            "💡 Support Prompt: Who is one person you can count on when exam stress gets heavy?",
            "💡 Focus Prompt: What is a study milestone you are proud of reaching recently?",
            "💡 Calming Prompt: What is a favorite relaxing activity you plan to do once this exam season is over?"
        ],

        // Phase 3: Mock Test Mode & Exam prep state
        examBreathingTimer: null,
        examBreathingSeconds: 120,
        examBreathingState: 0,
        examAffirmationIndex: 0,
        examAffirmations: [
            "I have prepared to the best of my ability. One test does not define my intelligence or future.",
            "I will focus on one question at a time. I am calm, prepared, and fully capable.",
            "Mistakes are just feedback. I will remain composed even when encountering complex questions.",
            "I breathe in focus and breathe out panic. My mind is sharp and clear."
        ],
        cachedMetrics: null
    };

    // DOM Element Selectors
    const appHeader = document.getElementById('app-header');
    const logoutBtn = document.getElementById('logout-btn');
    const userDisplay = document.getElementById('user-display');
    const examBadge = document.getElementById('exam-badge');
    const liveAnnouncer = document.getElementById('live-announcer');
    const emergencyBtn = document.getElementById('emergency-btn');

    // View panels
    const views = {
        auth: document.getElementById('view-auth'),
        dashboard: document.getElementById('view-dashboard'),
        'mood-logger': document.getElementById('view-mood-logger'),
        triggers: document.getElementById('view-triggers'),
        companion: document.getElementById('view-companion'),
        mindfulness: document.getElementById('view-mindfulness'),
        'exam-mode': document.getElementById('view-exam-mode'),
        journal: document.getElementById('view-journal'),
        emergency: document.getElementById('view-emergency')
    };

    // Helper: Screen Reader Announcer
    function announce(message) {
        liveAnnouncer.textContent = message;
    }

    // Helper: Read CSRF token from cookies
    function getCsrfToken() {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; XSRF-TOKEN=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return '';
    }

    // Helper: Perform secure API fetch with CSRF handling
    async function apiFetch(url, options = {}) {
        const csrfToken = getCsrfToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (csrfToken && ['POST', 'PUT', 'DELETE'].includes(options.method?.toUpperCase())) {
            headers['X-XSRF-TOKEN'] = csrfToken;
        }

        const response = await fetch(url, { ...options, headers });
        
        if (response.status === 401 && state.activeView !== 'auth') {
            handleLogoutState();
            throw new Error('Session expired. Please log in again.');
        }

        return response;
    }

    // Navigation and SPA Routing
    function navigateTo(viewId) {
        if (!views[viewId]) return;

        // Save previous view if not entering emergency
        if (state.activeView !== 'emergency') {
            state.previousView = state.activeView;
        }

        // Deactivate active nav button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.getAttribute('data-view') === viewId) {
                btn.classList.add('active');
                btn.setAttribute('aria-current', 'page');
            } else {
                btn.classList.remove('active');
                btn.removeAttribute('aria-current');
            }
        });

        // Hide all views, display the target view
        Object.entries(views).forEach(([id, element]) => {
            if (id === viewId) {
                element.classList.remove('hidden');
            } else {
                element.classList.add('hidden');
            }
        });

        state.activeView = viewId;
        
        // Focus Management (A11y)
        const viewHeader = views[viewId].querySelector('h1');
        if (viewHeader) {
            viewHeader.setAttribute('tabindex', '-1');
            viewHeader.focus();
        }

        // Set page context
        document.title = `Aura - ${viewId.charAt(0).toUpperCase() + viewId.slice(1)}`;
        announce(`Navigated to ${viewId} screen.`);

        // Stop mindfulness guide if user navigates away
        if (viewId !== 'mindfulness') {
            stopBreathingGuide();
        }
        if (viewId !== 'exam-mode') {
            stopExamBreathingGuide();
        }

        // Clean up audio context if leaving emergency mode
        if (viewId !== 'emergency') {
            stopSyntheticSound();
        }

        // Fetch data relevant to the view
        if (viewId === 'dashboard') {
            loadDashboardMetrics();
        } else if (viewId === 'triggers') {
            loadTriggersList();
        } else if (viewId === 'journal') {
            loadJournalEntries();
            rotateGratitudePrompt();
        } else if (viewId === 'exam-mode') {
            initExamMode();
        }
    }

    // Set up navigation event listeners
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const viewId = e.currentTarget.getAttribute('data-view');
            navigateTo(viewId);
        });
    });

    // Panic Button Trigger
    emergencyBtn.addEventListener('click', () => {
        navigateTo('emergency');
        initializeEmergencyGrounding();
    });


    // ==========================================
    // 1. AUTHENTICATION (LOGIN & REGISTRATION)
    // ==========================================
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLoginContainer = document.getElementById('form-login-container');
    const formRegisterContainer = document.getElementById('form-register-container');
    const authGeneralError = document.getElementById('auth-general-error');

    // Toggle registration/login tabs
    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabLogin.setAttribute('aria-selected', 'true');
        tabRegister.classList.remove('active');
        tabRegister.setAttribute('aria-selected', 'false');
        formLoginContainer.classList.remove('hidden');
        formRegisterContainer.classList.add('hidden');
        authGeneralError.classList.add('hidden');
    });

    tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabRegister.setAttribute('aria-selected', 'true');
        tabLogin.classList.remove('active');
        tabLogin.setAttribute('aria-selected', 'false');
        formRegisterContainer.classList.remove('hidden');
        formLoginContainer.classList.add('hidden');
        authGeneralError.classList.add('hidden');
    });

    function handleLoginSuccess(username, examType) {
        state.currentUser = username;
        state.currentExam = examType;
        userDisplay.textContent = username;
        examBadge.textContent = examType;
        
        appHeader.classList.remove('hidden');
        loginForm.reset();
        registerForm.reset();
        authGeneralError.classList.add('hidden');
        
        navigateTo('dashboard');
    }

    function handleLogoutState() {
        state.currentUser = null;
        state.currentExam = null;
        appHeader.classList.add('hidden');
        navigateTo('auth');
    }

    // Register Form Handler
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const usernameInput = document.getElementById('reg-username');
        const passwordInput = document.getElementById('reg-password');
        const examSelect = document.getElementById('reg-exam');

        document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
        authGeneralError.classList.add('hidden');

        let isValid = true;
        if (usernameInput.value.trim().length < 3) {
            document.getElementById('error-reg-username').textContent = 'Username must be at least 3 characters.';
            isValid = false;
        }
        if (passwordInput.value.length < 6) {
            document.getElementById('error-reg-password').textContent = 'Password must be at least 6 characters.';
            isValid = false;
        }
        if (!examSelect.value) {
            document.getElementById('error-reg-exam').textContent = 'Please select your target exam.';
            isValid = false;
        }

        if (!isValid) return;

        try {
            const res = await apiFetch('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    username: usernameInput.value.trim(),
                    password: passwordInput.value,
                    examType: examSelect.value
                })
            });

            if (res.ok) {
                const loginRes = await apiFetch('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({
                        username: usernameInput.value.trim(),
                        password: passwordInput.value
                    })
                });
                
                if (loginRes.ok) {
                    const data = await loginRes.json();
                    handleLoginSuccess(data.username, data.examType);
                } else {
                    tabLogin.click();
                    authGeneralError.textContent = 'Account created successfully! Please log in.';
                    authGeneralError.classList.remove('hidden');
                    authGeneralError.classList.replace('general-error-box', 'status-success');
                }
            } else {
                const errData = await res.json();
                if (errData.username) {
                    document.getElementById('error-reg-username').textContent = errData.username;
                } else {
                    authGeneralError.textContent = errData.error || 'Registration failed.';
                    authGeneralError.classList.remove('hidden');
                }
            }
        } catch (err) {
            authGeneralError.textContent = err.message || 'Network error.';
            authGeneralError.classList.remove('hidden');
        }
    });

    // Login Form Handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');

        document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
        authGeneralError.classList.add('hidden');

        if (!usernameInput.value.trim()) {
            document.getElementById('error-login-username').textContent = 'Username is required.';
            return;
        }
        if (!passwordInput.value) {
            document.getElementById('error-login-password').textContent = 'Password is required.';
            return;
        }

        try {
            const res = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    username: usernameInput.value.trim(),
                    password: passwordInput.value
                })
            });

            if (res.ok) {
                const data = await res.json();
                handleLoginSuccess(data.username, data.examType);
            } else {
                const errData = await res.json();
                authGeneralError.textContent = errData.error || 'Invalid credentials.';
                authGeneralError.classList.remove('hidden');
            }
        } catch (err) {
            authGeneralError.textContent = err.message || 'Connection failed.';
            authGeneralError.classList.remove('hidden');
        }
    });

    // Logout Handler
    logoutBtn.addEventListener('click', async () => {
        try {
            await apiFetch('/api/auth/logout', { method: 'POST' });
            handleLogoutState();
        } catch (err) {
            handleLogoutState();
        }
    });

    // Initial session status check on load
    async function checkSession() {
        try {
            const res = await fetch('/api/auth/status');
            if (res.ok) {
                const data = await res.json();
                if (data.authenticated) {
                    handleLoginSuccess(data.username, data.examType);
                } else {
                    handleLogoutState();
                }
            }
        } catch (e) {
            handleLogoutState();
        }
    }
    checkSession();


    // ==========================================
    // 2. DASHBOARD, COUNTDOWNS & STREAKS
    // ==========================================
    const dashAvgMood = document.getElementById('dash-avg-mood');
    const dashAvgStress = document.getElementById('dash-avg-stress');
    const dashBurnoutRisk = document.getElementById('dash-burnout-risk');
    const dashBurnoutDesc = document.getElementById('dash-burnout-desc');
    const dashStreak = document.getElementById('dash-streak');
    const countdownTitle = document.getElementById('countdown-title');
    const countdownDays = document.getElementById('countdown-days');
    const insightsList = document.getElementById('insights-list');
    const recsList = document.getElementById('recommendations-list');

    async function loadDashboardMetrics() {
        try {
            const res = await apiFetch('/api/wellness/metrics');
            if (res.ok) {
                const data = await res.json();
                state.cachedMetrics = data;
                
                // Average Mood & Stress
                dashAvgMood.textContent = data.averageMood > 0 ? `${data.averageMood}/5` : 'N/A';
                dashAvgStress.textContent = data.averageStress > 0 ? `${data.averageStress}/10` : 'N/A';

                // Burnout Radar Gauge
                const risk = data.burnoutRisk || 0;
                dashBurnoutRisk.textContent = `${risk}%`;
                if (risk > 70) {
                    dashBurnoutDesc.textContent = '⚠️ Critical Burnout Warning';
                    dashBurnoutDesc.style.color = 'var(--danger)';
                } else if (risk > 40) {
                    dashBurnoutDesc.textContent = '⚡ Moderate Fatigue Alert';
                    dashBurnoutDesc.style.color = 'var(--warning)';
                } else {
                    dashBurnoutDesc.textContent = '🛡️ Low Exhaustion Risk';
                    dashBurnoutDesc.style.color = 'var(--accent-teal)';
                }

                // Check-in Streak
                dashStreak.textContent = data.streak || 0;

                // Dynamic Exam Countdowns
                updateExamCountdown();

                // Check for Smart Break advice
                checkSmartBreakAdvise(data);

                // Insights & Recommendations
                insightsList.innerHTML = '';
                if (data.insights && data.insights.length > 0) {
                    data.insights.forEach(ins => {
                        const div = document.createElement('div');
                        div.className = 'insight-item';
                        div.textContent = ins;
                        insightsList.appendChild(div);
                    });
                } else {
                    insightsList.innerHTML = '<p class="subtitle">Complete wellness check-ins to build smart insights.</p>';
                }

                recsList.innerHTML = '';
                if (data.recommendations && data.recommendations.length > 0) {
                    data.recommendations.forEach(rec => {
                        const div = document.createElement('div');
                        div.className = 'rec-item';
                        div.textContent = rec;
                        recsList.appendChild(div);
                    });
                } else {
                    recsList.innerHTML = '<p class="subtitle">Personalized recommendations will appear here.</p>';
                }

                // Render or update Trend Chart
                renderTrendChart(data.trend);
            }
        } catch (err) {
            console.error('Failed to load metrics', err);
        }
    }

    function updateExamCountdown() {
        const exam = state.currentExam || 'JEE';
        countdownTitle.textContent = `${exam} Examination Countdown`;

        // Define mock targeted exam dates for 2027 season
        const targets = {
            JEE: new Date('2027-04-15T09:00:00'),
            NEET: new Date('2027-05-02T10:00:00'),
            UPSC: new Date('2027-05-30T09:00:00'),
            CAT: new Date('2026-11-29T08:30:00'),
            GATE: new Date('2027-02-06T09:30:00'),
            BOARDS: new Date('2027-03-01T10:00:00'),
            OTHER: new Date(new Date().getTime() + 100 * 24 * 60 * 60 * 1000) // 100 days from now
        };

        const targetDate = targets[exam] || targets['OTHER'];
        const diffTime = targetDate - new Date();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
            countdownDays.textContent = `${diffDays} days left until your target exam. Stay consistent, stay calm.`;
        } else {
            countdownDays.textContent = `Exam season is underway! Take deep breaths and trust your preparation.`;
        }
    }

    function renderTrendChart(trendData) {
        const ctx = document.getElementById('trendChart').getContext('2d');
        
        const labels = trendData.map(dp => {
            const date = new Date(dp.timestamp);
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        });
        const moodPoints = trendData.map(dp => dp.mood);
        const stressPoints = trendData.map(dp => dp.stress);
        const sleepPoints = trendData.map(dp => dp.sleep);
        const studyPoints = trendData.map(dp => dp.study);

        if (state.chartInstance) {
            state.chartInstance.destroy();
        }

        if (trendData.length === 0) {
            ctx.clearRect(0, 0, 400, 300);
            ctx.fillStyle = '#9ca3af';
            ctx.textAlign = 'center';
            ctx.font = '16px Inter';
            ctx.fillText('No data logged yet. Submit a daily check-in to see details!', 200, 150);
            return;
        }

        state.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Mood (1-5)',
                        data: moodPoints,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.05)',
                        borderWidth: 2,
                        tension: 0.2,
                        yAxisID: 'yMood'
                    },
                    {
                        label: 'Stress (1-10)',
                        data: stressPoints,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.05)',
                        borderWidth: 2,
                        tension: 0.2,
                        yAxisID: 'yStress'
                    },
                    {
                        label: 'Sleep (Hrs)',
                        data: sleepPoints,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        borderWidth: 1.5,
                        type: 'bar',
                        yAxisID: 'yHours'
                    },
                    {
                        label: 'Study (Hrs)',
                        data: studyPoints,
                        borderColor: '#a855f7',
                        borderWidth: 2.5,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.2,
                        yAxisID: 'yHours'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#f3f4f6',
                            font: { family: 'Inter', size: 11 }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#9ca3af' },
                        grid: { color: 'rgba(255, 255, 255, 0.03)' }
                    },
                    yMood: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: 1,
                        max: 5,
                        ticks: { color: '#10b981', stepSize: 1 },
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        title: { display: true, text: 'Mood Scale', color: '#10b981' }
                    },
                    yStress: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: 1,
                        max: 10,
                        ticks: { color: '#ef4444', stepSize: 2 },
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Stress Level', color: '#ef4444' }
                    },
                    yHours: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: 0,
                        max: 24,
                        ticks: { color: '#9ca3af', stepSize: 4 },
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Duration (Hours)', color: '#9ca3af' }
                    }
                }
            }
        });
    }


    // ==========================================
    // 3. DAILY WELLNESS CHECK-IN
    // ==========================================
    const moodForm = document.getElementById('mood-logger-form');
    const stressRange = document.getElementById('stress-range');
    const stressValueBadge = document.getElementById('stress-value-badge');
    const moodStatus = document.getElementById('mood-logger-status');

    stressRange.addEventListener('input', (e) => {
        stressValueBadge.textContent = e.target.value;
    });

    moodForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const moodChecked = moodForm.querySelector('input[name="moodLevel"]:checked');
        const selectedFeelings = Array.from(moodForm.querySelectorAll('input[name="feelings"]:checked')).map(cb => cb.value);
        const sleepInput = document.getElementById('mood-sleep');
        const studyInput = document.getElementById('mood-study');
        const noteInput = document.getElementById('mood-notes');

        document.getElementById('error-mood-picker').textContent = '';
        document.getElementById('error-mood-sleep').textContent = '';
        document.getElementById('error-mood-study').textContent = '';
        moodStatus.classList.add('hidden');

        let isValid = true;

        if (!moodChecked) {
            document.getElementById('error-mood-picker').textContent = 'Please choose how you are feeling overall.';
            isValid = false;
        }

        const sleepVal = parseFloat(sleepInput.value);
        if (isNaN(sleepVal) || sleepVal < 0 || sleepVal > 24) {
            document.getElementById('error-mood-sleep').textContent = 'Please enter sleep duration between 0 and 24 hours.';
            isValid = false;
        }

        const studyVal = parseFloat(studyInput.value);
        if (isNaN(studyVal) || studyVal < 0 || studyVal > 24) {
            document.getElementById('error-mood-study').textContent = 'Please enter study duration between 0 and 24 hours.';
            isValid = false;
        }

        if (!isValid) return;

        try {
            const res = await apiFetch('/api/wellness/mood', {
                method: 'POST',
                body: JSON.stringify({
                    moodLevel: parseInt(moodChecked.value),
                    feelings: selectedFeelings.join(','),
                    stressLevel: parseInt(stressRange.value),
                    note: noteInput.value,
                    sleepHours: sleepVal,
                    studyHours: studyVal
                })
            });

            if (res.ok) {
                moodStatus.textContent = '🎉 Daily check-in successfully submitted!';
                moodStatus.className = 'status-msg status-success';
                moodStatus.classList.remove('hidden');
                
                moodForm.reset();
                stressValueBadge.textContent = '5';
                announce('Check-in submitted.');

                setTimeout(() => {
                    navigateTo('dashboard');
                }, 1200);
            } else {
                const errData = await res.json();
                moodStatus.textContent = errData.error || 'Submission failed.';
                moodStatus.className = 'status-msg general-error-box';
                moodStatus.classList.remove('hidden');
            }
        } catch (err) {
            moodStatus.textContent = err.message;
            moodStatus.className = 'status-msg general-error-box';
            moodStatus.classList.remove('hidden');
        }
    });


    // ==========================================
    // 4. STRESS TRIGGERS
    // ==========================================
    const triggerForm = document.getElementById('trigger-form');
    const triggersListElements = document.getElementById('triggers-list-elements');
    const triggerStatus = document.getElementById('trigger-status');
    const triggerTypeSelect = document.getElementById('trigger-type');
    const mockTestFields = document.getElementById('mock-test-fields');

    // Toggle conditional mock test fields
    triggerTypeSelect.addEventListener('change', () => {
        if (triggerTypeSelect.value === 'Mock Tests' || triggerTypeSelect.value === 'Uncertainty') {
            mockTestFields.classList.remove('hidden');
        } else {
            mockTestFields.classList.add('hidden');
            // Reset fields
            document.getElementById('trigger-subject').value = '';
            document.getElementById('trigger-score').value = '';
            document.getElementById('trigger-max-score').value = '';
        }
    });

    triggerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const triggerNote = document.getElementById('trigger-note');
        const errorType = document.getElementById('error-trigger-type');

        const triggerSubject = document.getElementById('trigger-subject').value.trim();
        const triggerScore = document.getElementById('trigger-score').value.trim();
        const triggerMaxScore = document.getElementById('trigger-max-score').value.trim();

        errorType.textContent = '';
        triggerStatus.classList.add('hidden');

        if (!triggerTypeSelect.value) {
            errorType.textContent = 'Please select a trigger source.';
            return;
        }

        try {
            const bodyPayload = {
                triggerType: triggerTypeSelect.value,
                note: triggerNote.value
            };

            if (triggerTypeSelect.value === 'Mock Tests' || triggerTypeSelect.value === 'Uncertainty') {
                if (triggerSubject) bodyPayload.subjectTopic = triggerSubject;
                if (triggerScore) bodyPayload.testScore = parseInt(triggerScore);
                if (triggerMaxScore) bodyPayload.maxScore = parseInt(triggerMaxScore);
            }

            const res = await apiFetch('/api/wellness/trigger', {
                method: 'POST',
                body: JSON.stringify(bodyPayload)
            });

            if (res.ok) {
                triggerStatus.textContent = 'Stress trigger logged successfully!';
                triggerStatus.className = 'status-msg status-success';
                triggerStatus.classList.remove('hidden');
                
                triggerForm.reset();
                mockTestFields.classList.add('hidden');
                announce('Stress trigger logged.');
                loadTriggersList();
            } else {
                const errData = await res.json();
                triggerStatus.textContent = errData.error || 'Failed to save trigger.';
                triggerStatus.className = 'status-msg general-error-box';
                triggerStatus.classList.remove('hidden');
            }
        } catch (err) {
            triggerStatus.textContent = err.message;
            triggerStatus.className = 'status-msg general-error-box';
            triggerStatus.classList.remove('hidden');
        }
    });

    async function loadTriggersList() {
        try {
            const res = await apiFetch('/api/wellness/trigger');
            if (res.ok) {
                const triggers = await res.json();
                triggersListElements.innerHTML = '';
                
                if (triggers.length === 0) {
                    triggersListElements.innerHTML = '<p class="subtitle" style="text-align:center; padding-top:20px;">No triggers logged yet.</p>';
                    return;
                }

                triggers.forEach(t => {
                    const li = document.createElement('li');
                    li.className = 'timeline-item';
                    
                    const date = new Date(t.timestamp);
                    const formattedDate = date.toLocaleDateString(undefined, { 
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    });

                    let mockTestBadge = '';
                    if (t.testScore !== undefined && t.testScore !== null) {
                        const scoreStr = t.maxScore ? `${t.testScore}/${t.maxScore}` : `${t.testScore} marks`;
                        const subjectStr = t.subjectTopic ? ` in ${escapeHTML(t.subjectTopic)}` : '';
                        mockTestBadge = `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; margin-left: 8px;">Mock Test: ${scoreStr}${subjectStr}</span>`;
                    } else if (t.subjectTopic) {
                        mockTestBadge = `<span class="badge" style="background: rgba(20, 184, 166, 0.15); color: var(--accent-teal); border: 1px solid rgba(20, 184, 166, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; margin-left: 8px;">${escapeHTML(t.subjectTopic)}</span>`;
                    }

                    li.innerHTML = `
                        <div class="timeline-header">
                            <span class="timeline-title">${escapeHTML(t.triggerType)} ${mockTestBadge}</span>
                            <span class="timeline-time">${formattedDate}</span>
                        </div>
                        ${t.note ? `<p class="timeline-note">${escapeHTML(t.note)}</p>` : ''}
                    `;
                    triggersListElements.appendChild(li);
                });
            }
        } catch (err) {
            console.error('Failed to load triggers', err);
        }
    }


    // ==========================================
    // 5. CHAT WITH AURA
    // ==========================================
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const chatTyping = document.getElementById('chat-typing');

    function escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageText = chatInput.value.trim();
        if (!messageText) return;

        chatInput.value = '';
        appendMessage('user', messageText);
        
        chatTyping.classList.remove('hidden');
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const res = await apiFetch('/api/companion/chat', {
                method: 'POST',
                body: JSON.stringify({ message: messageText })
            });

            chatTyping.classList.add('hidden');

            if (res.ok) {
                const data = await res.json();
                appendMessage('aura', data.reply);
            } else {
                appendMessage('aura', "I apologize, but I encountered an error. Let's take a deep breath and start fresh.");
            }
        } catch (err) {
            chatTyping.classList.add('hidden');
            appendMessage('aura', "Connection lost. Try checking our Box Breathing Trainer to decompress.");
        }
    });

    function appendMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender === 'user' ? 'user-msg' : 'aura-msg'}`;
        const avatar = sender === 'user' ? '🎓' : '🍃';
        
        msgDiv.innerHTML = `
            <div class="msg-avatar">${avatar}</div>
            <div class="msg-bubble">
                <p>${escapeHTML(text)}</p>
            </div>
        `;
        chatMessages.appendChild(msgDiv);
        if (sender === 'aura') announce(`Aura replies: ${text}`);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }


    // ==========================================
    // 6. MINDFULNESS & TIMERS
    // ==========================================
    const breathingStartBtn = document.getElementById('breathing-start-btn');
    const breathingStopBtn = document.getElementById('breathing-stop-btn');
    const breathingCircle = document.getElementById('breathing-circle');
    const breathingInstruction = document.getElementById('breathing-instruction');
    const breathingTimerCount = document.getElementById('breathing-timer-count');

    const breathingCycle = [
        { label: 'Inhale...', duration: 4, action: 'inhale' },
        { label: 'Hold...', duration: 4, action: 'hold' },
        { label: 'Exhale...', duration: 4, action: 'exhale' },
        { label: 'Hold...', duration: 4, action: 'hold' }
    ];

    breathingStartBtn.addEventListener('click', startBreathingGuide);
    breathingStopBtn.addEventListener('click', stopBreathingGuide);

    function startBreathingGuide() {
        breathingStartBtn.classList.add('hidden');
        breathingStopBtn.classList.remove('hidden');
        state.breathingSeconds = 0;
        state.breathingState = 0;
        updateBreathingCycleStep();
        
        state.breathingTimer = setInterval(() => {
            state.breathingSeconds++;
            const minutes = Math.floor(state.breathingSeconds / 60);
            const seconds = state.breathingSeconds % 60;
            breathingTimerCount.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);

        announce("Guided breathing started.");
    }

    function updateBreathingCycleStep() {
        if (state.breathingTimer === null) return;
        const step = breathingCycle[state.breathingState];
        breathingInstruction.textContent = step.label;
        announce(step.label);

        breathingCircle.className = 'breathing-circle';
        if (step.action === 'inhale') {
            breathingCircle.classList.add('inhale');
        } else if (step.action === 'exhale') {
            breathingCircle.classList.add('exhale');
        } else if (step.action === 'hold') {
            breathingCircle.classList.add('hold');
        }

        setTimeout(() => {
            if (state.breathingTimer) {
                state.breathingState = (state.breathingState + 1) % breathingCycle.length;
                updateBreathingCycleStep();
            }
        }, step.duration * 1000);
    }

    function stopBreathingGuide() {
        if (state.breathingTimer) {
            clearInterval(state.breathingTimer);
            state.breathingTimer = null;
        }
        breathingStartBtn.classList.remove('hidden');
        breathingStopBtn.classList.add('hidden');
        breathingInstruction.textContent = 'Press Start';
        breathingTimerCount.textContent = '00:00';
        breathingCircle.className = 'breathing-circle';
        announce("Guided breathing stopped.");
    }

    // Pomodoro Timer
    const pomodoroTimerDisplay = document.getElementById('pomodoro-timer-display');
    const pomodoroPhaseLabel = document.getElementById('pomodoro-phase-label');
    const pomodoroStartBtn = document.getElementById('pomodoro-start-btn');
    const pomodoroPauseBtn = document.getElementById('pomodoro-pause-btn');
    const pomodoroResetBtn = document.getElementById('pomodoro-reset-btn');
    const pomodoroAlertBox = document.getElementById('pomodoro-alert-box');

    pomodoroStartBtn.addEventListener('click', startPomodoro);
    pomodoroPauseBtn.addEventListener('click', pausePomodoro);
    pomodoroResetBtn.addEventListener('click', resetPomodoro);

    function startPomodoro() {
        state.pomodoroIsRunning = true;
        pomodoroStartBtn.classList.add('hidden');
        pomodoroPauseBtn.classList.remove('hidden');
        
        state.pomodoroTimer = setInterval(() => {
            if (state.pomodoroTimeLeft > 0) {
                state.pomodoroTimeLeft--;
                updatePomodoroDisplay();
            } else {
                clearInterval(state.pomodoroTimer);
                triggerPomodoroPhaseTransition();
            }
        }, 1000);
        announce(`Pomodoro timer started. Phase: ${state.pomodoroPhase}`);
    }

    function pausePomodoro() {
        state.pomodoroIsRunning = false;
        clearInterval(state.pomodoroTimer);
        pomodoroStartBtn.classList.remove('hidden');
        pomodoroPauseBtn.classList.add('hidden');
        announce("Pomodoro timer paused.");
    }

    function resetPomodoro() {
        state.pomodoroIsRunning = false;
        clearInterval(state.pomodoroTimer);
        state.pomodoroPhase = 'focus';
        state.pomodoroTimeLeft = 1500;
        pomodoroStartBtn.classList.remove('hidden');
        pomodoroPauseBtn.classList.add('hidden');
        pomodoroAlertBox.classList.add('hidden');
        pomodoroPhaseLabel.textContent = 'Focus Interval';
        pomodoroPhaseLabel.style.color = 'var(--accent-blue)';
        updatePomodoroDisplay();
        announce("Pomodoro timer reset.");
    }

    function updatePomodoroDisplay() {
        const minutes = Math.floor(state.pomodoroTimeLeft / 60);
        const seconds = state.pomodoroTimeLeft % 60;
        pomodoroTimerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function triggerPomodoroPhaseTransition() {
        if (state.pomodoroPhase === 'focus') {
            state.pomodoroPhase = 'break';
            state.pomodoroTimeLeft = 300; // 5 mins break
            pomodoroPhaseLabel.textContent = 'Stress-Release Break';
            pomodoroPhaseLabel.style.color = 'var(--accent-teal)';
            pomodoroAlertBox.classList.remove('hidden');
            announce("Focus session complete! Take a break. Try a 2-minute breathing exercise.");
        } else {
            state.pomodoroPhase = 'focus';
            state.pomodoroTimeLeft = 1500;
            pomodoroPhaseLabel.textContent = 'Focus Interval';
            pomodoroPhaseLabel.style.color = 'var(--accent-blue)';
            pomodoroAlertBox.classList.add('hidden');
            announce("Break complete! Ready to study.");
        }
        updatePomodoroDisplay();
        startPomodoro();
    }


    // ==========================================
    // 7. PRIVATE REFLECTION DIARY (JOURNAL)
    // ==========================================
    const journalForm = document.getElementById('journal-form');
    const journalEntriesElements = document.getElementById('journal-entries-elements');
    const journalStatus = document.getElementById('journal-status');
    const gratitudePromptText = document.getElementById('gratitude-prompt-text');

    function rotateGratitudePrompt() {
        const index = Math.floor(Math.random() * state.gratitudePrompts.length);
        gratitudePromptText.textContent = state.gratitudePrompts[index];
    }

    journalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('journal-title');
        const contentInput = document.getElementById('journal-content');
        
        const errorTitle = document.getElementById('error-journal-title');
        const errorContent = document.getElementById('error-journal-content');

        errorTitle.textContent = '';
        errorContent.textContent = '';
        journalStatus.classList.add('hidden');

        let isValid = true;
        if (!titleInput.value.trim()) {
            errorTitle.textContent = 'Please enter a title.';
            isValid = false;
        }
        if (!contentInput.value.trim()) {
            errorContent.textContent = 'Journal contents cannot be empty.';
            isValid = false;
        }

        if (!isValid) return;

        try {
            const res = await apiFetch('/api/journal', {
                method: 'POST',
                body: JSON.stringify({
                    title: titleInput.value.trim(),
                    content: contentInput.value.trim()
                })
            });

            if (res.ok) {
                const data = await res.json();
                journalStatus.textContent = `Journal saved! Sentiment: ${data.sentiment}`;
                journalStatus.className = 'status-msg status-success';
                journalStatus.classList.remove('hidden');
                
                journalForm.reset();
                rotateGratitudePrompt();
                announce(`Journal entry successfully saved. Sentiment resolved as ${data.sentiment}.`);
                loadJournalEntries();
            } else {
                const errData = await res.json();
                journalStatus.textContent = errData.error || 'Failed to save journal.';
                journalStatus.className = 'status-msg general-error-box';
                journalStatus.classList.remove('hidden');
            }
        } catch (err) {
            journalStatus.textContent = err.message;
            journalStatus.className = 'status-msg general-error-box';
            journalStatus.classList.remove('hidden');
        }
    });

    async function loadJournalEntries() {
        try {
            const res = await apiFetch('/api/journal');
            if (res.ok) {
                const entries = await res.json();
                journalEntriesElements.innerHTML = '';

                if (entries.length === 0) {
                    journalEntriesElements.innerHTML = '<p class="subtitle" style="text-align:center; padding-top:20px;">No private reflections logged yet.</p>';
                    return;
                }

                entries.forEach(entry => {
                    const card = document.createElement('div');
                    card.className = 'journal-card';
                    const date = new Date(entry.timestamp);
                    const formattedDate = date.toLocaleDateString(undefined, { 
                        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    });

                    const sentimentClass = `sentiment-${entry.sentiment.toLowerCase()}`;

                    card.innerHTML = `
                        <div class="journal-card-header">
                            <div>
                                <span class="journal-title">${escapeHTML(entry.title)}</span>
                                <div class="journal-date">${formattedDate}</div>
                            </div>
                            <div class="journal-badge-row">
                                <span class="sentiment-badge ${sentimentClass}">${entry.sentiment}</span>
                                <button class="btn-delete" data-id="${entry.id}" aria-label="Delete Journal Entry">🗑️</button>
                            </div>
                        </div>
                        <p class="journal-card-body">${escapeHTML(entry.content)}</p>
                    `;

                    card.querySelector('.btn-delete').addEventListener('click', async (e) => {
                        const id = e.currentTarget.getAttribute('data-id');
                        if (confirm('Are you sure you want to delete this diary entry permanently?')) {
                            try {
                                const delRes = await apiFetch(`/api/journal/${id}`, { method: 'DELETE' });
                                if (delRes.ok) {
                                    announce('Journal entry deleted.');
                                    loadJournalEntries();
                                }
                            } catch (err) {
                                console.error('Deletion failed', err);
                            }
                        }
                    });

                    journalEntriesElements.appendChild(card);
                });
            }
        } catch (err) {
            console.error('Failed to load journal entries', err);
        }
    }


    // ==========================================
    // 8. EMERGENCY CALM GROUNDING SANCTUARY
    // ==========================================
    const groundingSanctuaryStages = [
        { title: "5. See", desc: "Look around you and name <strong>5 things</strong> you can see right now (e.g. a book, your pen, a desk light, your notebook)." },
        { title: "4. Touch", desc: "Reach out and feel <strong>4 things</strong> around you (e.g. your hair, the surface of your desk, the keys on your keyboard, your clothing)." },
        { title: "3. Hear", desc: "Listen carefully and isolate <strong>3 things</strong> you can hear in your environment (e.g. a fan humming, distant traffic, your own breathing)." },
        { title: "2. Smell", desc: "Inhale slowly and identify <strong>2 things</strong> you can smell (e.g. pencil graphite, coffee, page scent, clean air)." },
        { title: "1. Taste", desc: "Take a slow, mindful sip of water or focus on <strong>1 thing</strong> you can taste. Ground yourself in the present." }
    ];

    const groundingStageTitle = document.getElementById('grounding-stage-title');
    const groundingStageDesc = document.getElementById('grounding-stage-desc');
    const groundPrevBtn = document.getElementById('ground-prev-btn');
    const groundNextBtn = document.getElementById('ground-next-btn');
    const exitEmergencyBtn = document.getElementById('exit-emergency-btn');

    // Ambient Synthesizer Buttons
    const soundWhiteBtn = document.getElementById('sound-white-btn');
    const soundWavesBtn = document.getElementById('sound-waves-btn');
    const soundStopBtn = document.getElementById('sound-stop-btn');

    groundPrevBtn.addEventListener('click', () => {
        if (state.groundingStage > 0) {
            state.groundingStage--;
            updateGroundingStageUI();
        }
    });

    groundNextBtn.addEventListener('click', () => {
        if (state.groundingStage < groundingSanctuaryStages.length - 1) {
            state.groundingStage++;
            updateGroundingStageUI();
        }
    });

    exitEmergencyBtn.addEventListener('click', () => {
        stopSyntheticSound();
        navigateTo(state.previousView);
    });

    soundWhiteBtn.addEventListener('click', () => playSyntheticSound('white'));
    soundWavesBtn.addEventListener('click', () => playSyntheticSound('waves'));
    soundStopBtn.addEventListener('click', stopSyntheticSound);

    function initializeEmergencyGrounding() {
        state.groundingStage = 0;
        updateGroundingStageUI();
        announce("Welcome to Grounding Sanctuary. Follow the 5-4-3-2-1 steps.");
    }

    function updateGroundingStageUI() {
        const stage = groundingSanctuaryStages[state.groundingStage];
        groundingStageTitle.textContent = stage.title;
        groundingStageDesc.innerHTML = stage.desc;

        groundPrevBtn.disabled = (state.groundingStage === 0);
        
        if (state.groundingStage === groundingSanctuaryStages.length - 1) {
            groundNextBtn.textContent = "Grounding Complete";
            groundNextBtn.style.background = "var(--accent-teal)";
        } else {
            groundNextBtn.textContent = "Next Step";
            groundNextBtn.style.background = "#ef4444";
        }

        announce(`Grounding step: ${stage.title}. ${stage.desc}`);
    }

    // Audio Synthesizer via Web Audio API (High Efficiency: 0 assets downloaded)
    function playSyntheticSound(type) {
        stopSyntheticSound();

        try {
            // Instantiate Audio Context
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create a white noise buffer
            const bufferSize = 2 * state.audioContext.sampleRate;
            const noiseBuffer = state.audioContext.createBuffer(1, bufferSize, state.audioContext.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            // Create buffer source
            state.audioSource = state.audioContext.createBufferSource();
            state.audioSource.buffer = noiseBuffer;
            state.audioSource.loop = true;

            // Create Gain Node (volume control)
            state.audioGainNode = state.audioContext.createGain();
            
            if (type === 'white') {
                // Steady low volume white noise
                state.audioGainNode.gain.setValueAtTime(0.04, state.audioContext.currentTime);
                state.audioSource.connect(state.audioGainNode);
                state.audioGainNode.connect(state.audioContext.destination);
            } else if (type === 'waves') {
                // Ocean waves simulation: modulate white noise volume using a slow oscillator
                state.audioGainNode.gain.setValueAtTime(0.01, state.audioContext.currentTime);
                
                // Lowpass filter for deep ocean rumble
                const filter = state.audioContext.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 400;

                // Modulate gain dynamically using a slow low-frequency oscillator (LFO)
                state.audioOscillator = state.audioContext.createOscillator();
                state.audioOscillator.frequency.value = 0.12; // 0.12 Hz (one wave cycle every 8 seconds)
                
                const lfoGain = state.audioContext.createGain();
                lfoGain.gain.value = 0.05; // Modulation depth

                state.audioOscillator.connect(lfoGain);
                lfoGain.connect(state.audioGainNode.gain);

                state.audioSource.connect(filter);
                filter.connect(state.audioGainNode);
                state.audioGainNode.connect(state.audioContext.destination);
                
                state.audioOscillator.start();
            }

            state.audioSource.start();
            
            soundWhiteBtn.classList.add('hidden');
            soundWavesBtn.classList.add('hidden');
            soundStopBtn.classList.remove('hidden');
            announce(`Playing ambient ${type} noise synthesizer.`);
        } catch (e) {
            console.error("Web Audio API not supported or blocked", e);
        }
    }

    function stopSyntheticSound() {
        if (state.audioSource) {
            try { state.audioSource.stop(); } catch(e){}
            state.audioSource = null;
        }
        if (state.audioOscillator) {
            try { state.audioOscillator.stop(); } catch(e){}
            state.audioOscillator = null;
        }
        if (state.audioContext) {
            try { state.audioContext.close(); } catch(e){}
            state.audioContext = null;
        }

        soundWhiteBtn.classList.remove('hidden');
        soundWavesBtn.classList.remove('hidden');
        soundStopBtn.classList.add('hidden');
        announce("Ambient sound stopped.");
    }

    // ==========================================
    // 9. PHASE 3: ADAPTIVE WELLNESS FEATURES
    // ==========================================

    // Smart Break Advisor
    const smartBreakWidget = document.getElementById('smart-break-widget');
    const breakAlertDesc = document.getElementById('break-alert-desc');
    const breakActionBtn = document.getElementById('break-action-btn');

    function checkSmartBreakAdvise(data) {
        if (!data || !data.trend || data.trend.length === 0) {
            smartBreakWidget.classList.add('hidden');
            return;
        }

        const latestLog = data.trend[data.trend.length - 1];
        const studyVal = latestLog.study || 0;
        const stressVal = latestLog.stress || 0;

        let recommendation = '';
        if (studyVal >= 4) {
            recommendation = "You've studied " + studyVal + " hours today. We recommend an eye care stretch (20-20-20 rule: look at an object 20 feet away for 20 seconds) to prevent visual fatigue.";
        } else if (stressVal >= 7) {
            recommendation = "Your logged stress level is high (" + stressVal + "/10). Take a 2-minute box breathing session in Mock Test Mode to reset your nervous system.";
        } else if (data.burnoutRisk >= 50) {
            recommendation = "Burnout Risk is elevated at " + data.burnoutRisk + "%. Take a mindful micro-break and listen to Ocean Waves.";
        }

        if (recommendation) {
            breakAlertDesc.textContent = recommendation;
            smartBreakWidget.classList.remove('hidden');
        } else {
            smartBreakWidget.classList.add('hidden');
        }
    }

    breakActionBtn.addEventListener('click', () => {
        navigateTo('exam-mode');
    });

    // Mock Test Mode (Pre-Exam Grounding)
    const examBreathingCircle = document.getElementById('exam-breathing-circle');
    const examBreathingInstruction = document.getElementById('exam-breathing-instruction');
    const examBreathingTimerCount = document.getElementById('exam-breathing-timer-count');
    const examBreathingStartBtn = document.getElementById('exam-breathing-start-btn');
    const examBreathingStopBtn = document.getElementById('exam-breathing-stop-btn');
    const examAffirmationBox = document.getElementById('exam-affirmation-box');
    const nextAffirmationBtn = document.getElementById('next-affirmation-btn');
    const cheatSheetNotes = document.getElementById('cheat-sheet-notes');

    const examBreathingCycle = [
        { label: 'Inhale...', duration: 4, action: 'inhale' },
        { label: 'Hold...', duration: 4, action: 'hold' },
        { label: 'Exhale...', duration: 4, action: 'exhale' },
        { label: 'Hold...', duration: 4, action: 'hold' }
    ];

    function initExamMode() {
        // Load Affirmation
        state.examAffirmationIndex = 0;
        examAffirmationBox.textContent = `"${state.examAffirmations[0]}"`;

        // Load Cheat Sheet
        const savedNotes = localStorage.getItem('aura_cheat_sheet_' + state.currentUser) || '';
        cheatSheetNotes.value = savedNotes;

        stopExamBreathingGuide();
    }

    // Auto-save cheat sheet
    cheatSheetNotes.addEventListener('input', () => {
        localStorage.setItem('aura_cheat_sheet_' + state.currentUser, cheatSheetNotes.value);
    });

    nextAffirmationBtn.addEventListener('click', () => {
        state.examAffirmationIndex = (state.examAffirmationIndex + 1) % state.examAffirmations.length;
        examAffirmationBox.textContent = `"${state.examAffirmations[state.examAffirmationIndex]}"`;
        announce("Affirmation rotated.");
    });

    examBreathingStartBtn.addEventListener('click', startExamBreathingGuide);
    examBreathingStopBtn.addEventListener('click', stopExamBreathingGuide);

    function startExamBreathingGuide() {
        examBreathingStartBtn.classList.add('hidden');
        examBreathingStopBtn.classList.remove('hidden');
        state.examBreathingSeconds = 120; // 2 minutes
        state.examBreathingState = 0;
        updateExamBreathingCycleStep();

        state.examBreathingTimer = setInterval(() => {
            if (state.examBreathingSeconds > 0) {
                state.examBreathingSeconds--;
                const minutes = Math.floor(state.examBreathingSeconds / 60);
                const seconds = state.examBreathingSeconds % 60;
                examBreathingTimerCount.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                stopExamBreathingGuide();
            }
        }, 1000);
        announce("Pre-exam breathing starter clicked.");
    }

    function updateExamBreathingCycleStep() {
        if (state.examBreathingTimer === null) return;
        const step = examBreathingCycle[state.examBreathingState];
        examBreathingInstruction.textContent = step.label;
        announce(step.label);

        examBreathingCircle.className = 'breathing-circle';
        if (step.action === 'inhale') {
            examBreathingCircle.classList.add('inhale');
        } else if (step.action === 'exhale') {
            examBreathingCircle.classList.add('exhale');
        } else if (step.action === 'hold') {
            examBreathingCircle.classList.add('hold');
        }

        setTimeout(() => {
            if (state.examBreathingTimer) {
                state.examBreathingState = (state.examBreathingState + 1) % examBreathingCycle.length;
                updateExamBreathingCycleStep();
            }
        }, step.duration * 1000);
    }

    function stopExamBreathingGuide() {
        if (state.examBreathingTimer) {
            clearInterval(state.examBreathingTimer);
            state.examBreathingTimer = null;
        }
        examBreathingStartBtn.classList.remove('hidden');
        examBreathingStopBtn.classList.add('hidden');
        examBreathingInstruction.textContent = 'Get Ready';
        examBreathingTimerCount.textContent = '02:00';
        examBreathingCircle.className = 'breathing-circle';
        announce("Pre-exam breathing stopped.");
    }

    // Wellness Report Modal Handlers
    const showReportBtn = document.getElementById('show-report-btn');
    const closeReportBtn = document.getElementById('close-report-btn');
    const printReportBtn = document.getElementById('print-report-btn');
    const reportModal = document.getElementById('report-modal');

    const rAvgSleep = document.getElementById('report-avg-sleep');
    const rAvgStudy = document.getElementById('report-avg-study');
    const rStreak = document.getElementById('report-streak');
    const rAvgMood = document.getElementById('report-avg-mood');
    const rAvgStress = document.getElementById('report-avg-stress');
    const rBurnout = document.getElementById('report-burnout');
    const rTriggersList = document.getElementById('report-triggers-list');
    const rAdvice = document.getElementById('report-advice');

    showReportBtn.addEventListener('click', async () => {
        const data = state.cachedMetrics || {
            averageMood: 0,
            averageStress: 0,
            averageSleep: 0,
            averageStudy: 0,
            burnoutRisk: 0,
            streak: 0
        };

        // Populate metrics
        rAvgSleep.textContent = data.averageSleep > 0 ? data.averageSleep.toFixed(1) : '0';
        rAvgStudy.textContent = data.averageStudy > 0 ? data.averageStudy.toFixed(1) : '0';
        rStreak.textContent = data.streak || '0';
        rAvgMood.textContent = data.averageMood > 0 ? data.averageMood.toFixed(1) : '0';
        rAvgStress.textContent = data.averageStress > 0 ? data.averageStress.toFixed(1) : '0';
        rBurnout.textContent = `${data.burnoutRisk || 0}%`;

        // Load Triggers and count frequencies
        try {
            const triggersRes = await apiFetch('/api/wellness/trigger');
            if (triggersRes.ok) {
                const triggers = await triggersRes.json();
                const freq = {};
                triggers.forEach(t => {
                    freq[t.triggerType] = (freq[t.triggerType] || 0) + 1;
                });

                rTriggersList.innerHTML = '';
                const sorted = Object.entries(freq).sort((a,b) => b[1] - a[1]);
                if (sorted.length > 0) {
                    sorted.forEach(([type, count]) => {
                        const li = document.createElement('li');
                        li.innerHTML = `<strong>${escapeHTML(type)}:</strong> logged ${count} time(s)`;
                        rTriggersList.appendChild(li);
                    });
                } else {
                    rTriggersList.innerHTML = '<li>No stress triggers logged recently. You are in a balanced state!</li>';
                }
            }
        } catch (e) {
            rTriggersList.innerHTML = '<li>Error loading trigger history.</li>';
        }

        // Set advice
        let advice = "A balanced routine of study and restorative sleep is critical during competitive exam preparation. Focus on consistency.";
        if (data.burnoutRisk > 60) {
            advice = "⚠️ High Burnout Risk detected. Your study duration significantly dwarfs your rest cycles. We strongly recommend reducing daily target study hours slightly, sleeping at least 7 hours, and integrating 2-3 daily mindfulness check-ins.";
        } else if (data.averageStress > 7) {
            advice = "⚡ High Academic Stress detected. Academic triggers are affecting your anxiety baseline. Utilize our Pre-Exam Grounding checklists and formula sheet notes daily before studying to steady your concentration.";
        } else if (data.averageSleep < 6) {
            advice = "😴 Sleep Deprivation Alert. Sleep averages are below 6 hours. Cognitive retention drops dramatically without REM sleep. Prioritize sleep health to maximize mock test performance.";
        } else if (data.streak >= 3) {
            advice = "🎉 Excellent consistency! Your check-in streak shows solid accountability. Your study hours and sleep patterns look clean and stable. Keep maintaining this healthy equilibrium.";
        }

        rAdvice.textContent = advice;

        // Display modal
        reportModal.classList.remove('hidden');
        announce("Wellness report modal open.");
    });

    closeReportBtn.addEventListener('click', () => {
        reportModal.classList.add('hidden');
        announce("Wellness report modal closed.");
    });

    printReportBtn.addEventListener('click', () => {
        window.print();
    });

    // Close on overlay click
    reportModal.addEventListener('click', (e) => {
        if (e.target === reportModal) {
            reportModal.classList.add('hidden');
        }
    });
});
