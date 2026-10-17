document.addEventListener('DOMContentLoaded', () => {
    const TARGET_NAME = "Sengve Rongpharpi";

    // DOM Elements - Screens
    const authScreen = document.getElementById('auth-screen');
    const envelopeScreen = document.getElementById('envelope-screen');
    const mainContent = document.getElementById('main-content');
    const sparkContainer = document.getElementById('spark-container');

    // Auth Form Elements
    const authForm = document.getElementById('auth-form');
    const passkeyInput = document.getElementById('passkey-input');
    const authError = document.getElementById('auth-error');

    // Admin Modal Elements
    const adminModal = document.getElementById('admin-modal');
    const adminTrigger = document.getElementById('admin-modal-trigger');
    const closeAdminBtn = document.getElementById('close-admin-btn');
    const refreshAdminBtn = document.getElementById('refresh-admin-btn');
    const adminDbStatus = document.getElementById('admin-db-status');
    const adminProposalStatus = document.getElementById('admin-proposal-status');
    const adminVoucherCount = document.getElementById('admin-voucher-count');
    const adminVouchersList = document.getElementById('admin-vouchers-list');
    const adminEventsList = document.getElementById('admin-events-list');

    let currentRole = null;
    let adminPassStored = 'admin777';

    // ==========================================
    // 1. Synthesized Audio Engine & SFX (Global)
    // ==========================================
    let audioCtx = null;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    function playSfx(type) {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            if (type === 'unlock') {
                [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + i * 0.07);
                    gain.gain.setValueAtTime(0.001, now + i * 0.07);
                    gain.gain.linearRampToValueAtTime(0.2, now + i * 0.07 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.45);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + i * 0.07);
                    osc.stop(now + i * 0.07 + 0.5);
                });
            } else if (type === 'bell') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.85);
            } else if (type === 'fanfare') {
                [523.25, 659.25, 783.99, 1046.50].forEach((freq) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now);
                    gain.gain.setValueAtTime(0.18, now);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now);
                    osc.stop(now + 1.25);
                });
            } else if (type === 'pop') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(480, now);
                osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.11);
            }
        } catch (e) {
            console.warn("SFX error:", e);
        }
    }
    window.playSfx = playSfx;

    // ==========================================
    // 2. API Helper Functions (Direct MongoDB Sync)
    // ==========================================
    async function apiRequest(endpoint, method = 'GET', body = null, headers = {}) {
        // Safe check for static dev environments (e.g. Live Server port 5500, file:// protocol)
        const isStaticDev = (window.location.protocol === 'file:' || window.location.port === '5500' || window.location.port === '5501');
        if (isStaticDev) {
            return { success: true, localMock: true, role: 'sengve' };
        }

        try {
            const config = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };
            if (body) {
                config.body = JSON.stringify(body);
            }
            const res = await fetch(endpoint, config);
            if (!res.ok) {
                return { success: false, status: res.status };
            }
            return await res.json();
        } catch (err) {
            console.warn("Backend sync notice:", err.message);
            return { success: false, fallback: true };
        }
    }

    async function logDbEvent(eventType, details = {}) {
        try {
            const list = JSON.parse(localStorage.getItem('sengve_events') || '[]');
            list.push({ eventType, details, time: new Date().toISOString() });
            localStorage.setItem('sengve_events', JSON.stringify(list));
        } catch(e) {}
        await apiRequest('/api/event', 'POST', {
            eventType,
            userName: TARGET_NAME,
            details
        });
    }

    async function claimVoucherInDb(voucherName) {
        try {
            const list = JSON.parse(localStorage.getItem('sengve_vouchers') || '[]');
            if (!list.includes(voucherName)) list.push(voucherName);
            localStorage.setItem('sengve_vouchers', JSON.stringify(list));
        } catch(e) {}
        return await apiRequest('/api/vouchers/claim', 'POST', { voucherName });
    }

    async function respondProposalInDb(answer = 'YES') {
        try {
            localStorage.setItem('sengve_proposal_answer', answer);
            localStorage.setItem('sengve_proposal_time', new Date().toISOString());
        } catch(e) {}
        return await apiRequest('/api/proposal/respond', 'POST', { answer });
    }

    // ==========================================
    // 3. VIP Gatekeeper & Access Control
    // ==========================================
    async function verifyAndEnter(passkey) {
        if (!passkey) return;
        const cleaned = passkey.toString().trim().toLowerCase();

        // Local check first for instant responsiveness
        const isSengve = (
            cleaned === 'sengve' ||
            cleaned === 'sengve rongpharpi' ||
            cleaned === 'rongpharpi' ||
            cleaned === '1910' ||
            cleaned === 'sengve19'
        );

        const isAdmin = (
            cleaned === 'admin' ||
            cleaned === 'admin777' ||
            cleaned === 'chandigarh'
        );

        // Try backend verification
        const serverRes = await apiRequest('/api/auth', 'POST', { passkey });

        if (serverRes.success && serverRes.role === 'admin' || isAdmin) {
            currentRole = 'admin';
            adminPassStored = cleaned;
            authScreen.classList.add('d-none');
            openAdminModal();
            showToast("Welcome Admin! Live monitor opened. 🛠️");
            return;
        }

        if (serverRes.success && serverRes.role === 'sengve' || isSengve) {
            currentRole = 'sengve';
            authError.classList.add('d-none');
            
            playSfx('unlock');
            showToast(`Welcome, Sengve Rongpharpi! ❤️ Access Granted.`);

            authScreen.classList.add('animate__animated', 'animate__fadeOut');
            setTimeout(() => {
                authScreen.classList.add('d-none');
                envelopeScreen.classList.remove('d-none');
                envelopeScreen.classList.add('animate__animated', 'animate__fadeIn');
                window.scrollTo({ top: 0, behavior: 'instant' });
            }, 500);

            logDbEvent('VIP_GATE_OPENED_BY_SENGVE', { passkeyUsed: passkey });
            return;
        }

        // Access Denied
        authError.classList.remove('d-none');
        passkeyInput.value = '';
        passkeyInput.focus();
    }

    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            verifyAndEnter(passkeyInput.value);
        });
    }

    // One-Tap VIP Entry for Sengve
    const quickSengveBtn = document.getElementById('quick-sengve-btn');
    if (quickSengveBtn) {
        quickSengveBtn.addEventListener('click', () => {
            if (passkeyInput) passkeyInput.value = 'Sengve Rongpharpi';
            triggerMiniConfetti();
            verifyAndEnter('Sengve Rongpharpi');
        });
    }

    // Toggle Passcode Visibility
    const togglePassBtn = document.getElementById('toggle-pass-visibility');
    if (togglePassBtn && passkeyInput) {
        togglePassBtn.addEventListener('click', () => {
            const isPass = passkeyInput.type === 'password';
            passkeyInput.type = isPass ? 'text' : 'password';
            togglePassBtn.innerHTML = isPass ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        });
    }

    // Direct VIP URL Token Check (e.g., ?for=sengve or ?key=1910)
    const urlParams = new URLSearchParams(window.location.search);
    const urlKey = urlParams.get('key') || urlParams.get('name') || urlParams.get('for') || urlParams.get('vip');
    const adminKey = urlParams.get('admin');

    if (urlKey) {
        verifyAndEnter(urlKey);
    } else if (adminKey) {
        verifyAndEnter(adminKey);
    }

    // ==========================================
    // 3. Admin Live Monitor Modal
    // ==========================================
    async function loadAdminData() {
        adminDbStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        const res = await apiRequest('/api/admin/dashboard', 'GET', null, {
            'x-admin-pass': adminPassStored
        });

        if (res.success) {
            adminDbStatus.innerHTML = res.isMongoConnected 
                ? '<span class="text-success"><i class="fas fa-circle-check"></i> MongoDB Live</span>' 
                : '<span class="text-warning"><i class="fas fa-server"></i> Local Sync Active</span>';

            adminProposalStatus.innerHTML = res.proposalStatus === 'YES' 
                ? '<span class="text-success fw-bold">❤️ YES (Accepted!)</span>' 
                : '<span class="text-secondary">Pending...</span>';

            adminVoucherCount.innerText = res.totalClaimedVouchers || 0;

            // Render Vouchers
            if (res.vouchers && res.vouchers.length > 0) {
                adminVouchersList.innerHTML = res.vouchers.map(v => `
                    <div class="admin-log-item d-flex justify-content-between">
                        <span class="text-white">🎟️ ${v.voucherName}</span>
                        <span class="opacity-50">${new Date(v.claimedAt).toLocaleTimeString()}</span>
                    </div>
                `).join('');
            } else {
                adminVouchersList.innerHTML = '<span class="opacity-50 small">No vouchers claimed yet.</span>';
            }

            // Render Events
            if (res.recentEvents && res.recentEvents.length > 0) {
                adminEventsList.innerHTML = res.recentEvents.map(e => `
                    <div class="admin-log-item d-flex justify-content-between">
                        <span class="text-info">⚡ ${e.eventType}</span>
                        <span class="opacity-50">${new Date(e.timestamp).toLocaleTimeString()}</span>
                    </div>
                `).join('');
            } else {
                adminEventsList.innerHTML = '<span class="opacity-50 small">Waiting for activity...</span>';
            }
        }
    }

    function openAdminModal() {
        adminModal.classList.remove('d-none');
        loadAdminData();
    }

    if (adminTrigger) {
        adminTrigger.addEventListener('click', () => {
            if (currentRole === 'admin') {
                openAdminModal();
            } else {
                const pass = prompt("Enter Admin Passcode to view Live Database Monitor:");
                if (pass) {
                    verifyAndEnter(pass);
                }
            }
        });
    }

    if (closeAdminBtn) {
        closeAdminBtn.addEventListener('click', () => {
            adminModal.classList.add('d-none');
        });
    }

    if (refreshAdminBtn) {
        refreshAdminBtn.addEventListener('click', loadAdminData);
    }

    // ==========================================
    // 4. Audio Controller ("Happy Birthday to Sengve" Real Vocal Song Player)
    // ==========================================
    const musicToggle = document.getElementById('music-toggle');
    const musicSub = document.getElementById('music-sub');
    const birthdayAudio = document.getElementById('birthday-audio-player');
    let isPlaying = false;

    function startRomanticMusic() {
        if (!birthdayAudio) return;
        birthdayAudio.play().then(() => {
            isPlaying = true;
            if (musicToggle) musicToggle.classList.add('playing');
            if (musicSub) musicSub.innerText = "Singing Happy Birthday 🎤🎵";
        }).catch(err => {
            console.log("Audio play allowed on user interaction:", err.message);
        });
    }

    function stopRomanticMusic() {
        if (!birthdayAudio) return;
        birthdayAudio.pause();
        isPlaying = false;
        if (musicToggle) musicToggle.classList.remove('playing');
        if (musicSub) musicSub.innerText = "Tap to play song 🎵";
    }

    if (musicToggle) {
        musicToggle.addEventListener('click', () => {
            if (isPlaying) {
                stopRomanticMusic();
                showToast("Song paused ⏸️");
            } else {
                startRomanticMusic();
                showToast("Playing Happy Birthday Song for Sengve! 🎤🎶");
            }
        });
    }

    if (birthdayAudio) {
        birthdayAudio.addEventListener('play', () => {
            isPlaying = true;
            if (musicToggle) musicToggle.classList.add('playing');
            if (musicSub) musicSub.innerText = "Singing Happy Birthday 🎤🎵";
        });
        birthdayAudio.addEventListener('pause', () => {
            isPlaying = false;
            if (musicToggle) musicToggle.classList.remove('playing');
            if (musicSub) musicSub.innerText = "Tap to play song 🎵";
        });
        birthdayAudio.addEventListener('ended', () => {
            birthdayAudio.currentTime = 0;
            birthdayAudio.play().catch(() => {});
        });
    }

    // Helper for subtle chime effects
    function playCrystalChime(pitchName, duration = 0.55) {
        if (typeof playSfx === 'function') {
            playSfx('bell');
        }
    }

    // ==========================================
    // 4.5 Floating 3D Balloons System (Flanking & Rich Presence)
    // ==========================================
    const balloonsContainer = document.getElementById('balloons-container');
    const balloonColors = [
        'linear-gradient(135deg, #ff2a85, #ff71a9)', // Hot Romantic Pink
        'linear-gradient(135deg, #ffd700, #ff9e00)', // Radiant Royal Gold
        'linear-gradient(135deg, #c084fc, #7928ca)', // Regal Violet
        'linear-gradient(135deg, #ff3366, #ba0c2f)', // Deep Crimson Velvet
        'linear-gradient(135deg, #38bdf8, #1d4ed8)', // Sky Sapphire
        'linear-gradient(135deg, #ff758c, #ff7eb3)', // Soft Peach Rose
        'linear-gradient(135deg, #f472b6, #db2777)', // Blossom Magenta
        'linear-gradient(135deg, #fef08a, #f59e0b)', // Warm Champagne
        'linear-gradient(135deg, #a78bfa, #6366f1)', // Electric Lavender
        'linear-gradient(135deg, #ffffff, #fbcfe8)'  // Pearlescent Silk
    ];

    function createBalloon(preferredFlank, initialStagger = false) {
        if (!balloonsContainer) return;
        const balloon = document.createElement('div');
        
        // Determine flank: left (45%), right (45%), or center background (10%)
        let flank = preferredFlank;
        if (!flank) {
            const rand = Math.random();
            if (rand < 0.45) flank = 'left';
            else if (rand < 0.90) flank = 'right';
            else flank = 'center';
        }

        balloon.className = `balloon flank-${flank}`;
        if (flank === 'center') balloon.classList.add('center-bg');

        const isMobile = window.innerWidth <= 768;
        const size = isMobile 
            ? Math.floor(Math.random() * 18) + 40 // 40px to 58px on mobile
            : Math.floor(Math.random() * 26) + 48; // 48px to 74px on desktop
        const height = Math.round(size * 1.25);
        const color = balloonColors[Math.floor(Math.random() * balloonColors.length)];

        // Position coordinates based on flank
        let left;
        if (flank === 'left') {
            // Flanked generously on the left
            left = isMobile ? (Math.random() * 18 + 1) : (Math.random() * 26 + 2);
        } else if (flank === 'right') {
            // Flanked generously on the right
            left = isMobile ? (Math.random() * 18 + 80) : (Math.random() * 25 + 73);
        } else {
            // Subtle in background center
            left = Math.random() * 40 + 30;
        }

        const duration = Math.random() * 8 + (isMobile ? 14 : 16); // 14s to 24s

        balloon.style.width = `${size}px`;
        balloon.style.height = `${height}px`;
        balloon.style.background = color;
        balloon.style.left = `${left.toFixed(1)}vw`;
        balloon.style.animationDuration = `${duration.toFixed(1)}s`;

        if (initialStagger) {
            // Negative delay so balloons are ALREADY floating mid-air immediately on page load!
            const negativeDelay = -(Math.random() * duration * 0.95).toFixed(2);
            balloon.style.animationDelay = `${negativeDelay}s`;
        } else {
            balloon.style.animationDelay = `${(Math.random() * 1.5).toFixed(2)}s`;
        }

        // Balloon string
        const string = document.createElement('div');
        string.className = 'balloon-string';
        balloon.appendChild(string);

        // Click or tap to pop!
        const popBalloon = (e) => {
            e.stopPropagation();
            if (typeof playSfx === 'function') playSfx('pop');
            if (typeof triggerMiniConfetti === 'function') triggerMiniConfetti();
            balloon.style.transition = 'all 0.16s ease-out';
            balloon.style.transform = 'scale(1.4)';
            balloon.style.opacity = '0';
            setTimeout(() => {
                balloon.remove();
                setTimeout(() => createBalloon(flank, false), 1500); // respawn in same flank
            }, 180);
        };

        balloon.addEventListener('click', popBalloon);
        balloon.addEventListener('touchstart', popBalloon, { passive: true });

        balloonsContainer.appendChild(balloon);

        // Respawn upon animation completion
        balloon.addEventListener('animationend', () => {
            if (balloon.parentNode) {
                balloon.remove();
                createBalloon(flank, false);
            }
        });
    }

    // Launch initial balloons immediately flanking left and right
    const isMobileDevice = window.innerWidth <= 768;
    const initialCount = isMobileDevice ? 18 : 34;
    for (let i = 0; i < initialCount; i++) {
        const targetFlank = (i % 2 === 0) ? 'left' : ((i % 5 === 0) ? 'center' : 'right');
        createBalloon(targetFlank, true);
    }

    // ==========================================
    // 4.6 Fireworks Celebration Particle Engine
    // ==========================================
    const fwCanvas = document.getElementById('fireworks-canvas');
    let fwCtx = fwCanvas ? fwCanvas.getContext('2d') : null;
    let fireworksList = [];
    let fwAnimationActive = false;

    function resizeFwCanvas() {
        if (!fwCanvas) return;
        fwCanvas.width = window.innerWidth;
        fwCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeFwCanvas);
    resizeFwCanvas();

    function triggerFireworks() {
        if (!fwCanvas || !fwCtx) return;
        const colors = ['#ffd700', '#ff007f', '#ff758c', '#00d2ff', '#ffffff', '#a855f7'];

        for (let burst = 0; burst < 5; burst++) {
            setTimeout(() => {
                const burstX = Math.random() * (fwCanvas.width * 0.7) + fwCanvas.width * 0.15;
                const burstY = Math.random() * (fwCanvas.height * 0.45) + fwCanvas.height * 0.1;
                const burstColor = colors[Math.floor(Math.random() * colors.length)];

                for (let i = 0; i < 40; i++) {
                    const angle = (Math.PI * 2 * i) / 40;
                    const speed = Math.random() * 5 + 2;
                    fireworksList.push({
                        x: burstX,
                        y: burstY,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        alpha: 1,
                        color: burstColor,
                        decay: Math.random() * 0.015 + 0.014,
                        size: Math.random() * 2.5 + 1.5
                    });
                }
            }, burst * 320);
        }

        if (!fwAnimationActive) {
            fwAnimationActive = true;
            requestAnimationFrame(renderFireworks);
        }
    }

    function renderFireworks() {
        if (!fwCtx || fireworksList.length === 0) {
            if (fwCtx) fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height);
            fwAnimationActive = false;
            return;
        }

        fwCtx.clearRect(0, 0, fwCanvas.width, fwCanvas.height);

        for (let i = fireworksList.length - 1; i >= 0; i--) {
            const p = fireworksList[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.055; // gravity
            p.vx *= 0.98; // air resistance
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                fireworksList.splice(i, 1);
                continue;
            }

            fwCtx.save();
            fwCtx.globalAlpha = Math.max(0, p.alpha);
            fwCtx.beginPath();
            fwCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            fwCtx.fillStyle = p.color;
            fwCtx.shadowBlur = 8;
            fwCtx.shadowColor = p.color;
            fwCtx.fill();
            fwCtx.restore();
        }

        requestAnimationFrame(renderFireworks);
    }

    // ==========================================
    // 5. Heart Trail Effect on Mouse & Touch
    // ==========================================
    const createCursorHeart = (x, y) => {
        const heart = document.createElement('i');
        heart.className = 'fas fa-heart cursor-heart';
        heart.style.left = `${x}px`;
        heart.style.top = `${y}px`;
        document.body.appendChild(heart);
        setTimeout(() => heart.remove(), 1000);
    };

    document.addEventListener('mousemove', (e) => {
        if (Math.random() > 0.15) return;
        createCursorHeart(e.pageX, e.pageY);
    });

    document.addEventListener('touchmove', (e) => {
        if (Math.random() > 0.3) return;
        const touch = e.touches[0];
        if (touch) {
            createCursorHeart(touch.pageX, touch.pageY);
        }
    }, { passive: true });

    // ==========================================
    // 6. Envelope Opening Logic
    // ==========================================
    const envelopeWrapper = document.getElementById('envelope-wrapper');
    if (envelopeWrapper) {
        envelopeWrapper.addEventListener('click', () => {
            envelopeWrapper.classList.add('open');
            
            if (!isPlaying) {
                startRomanticMusic();
            }

            logDbEvent('ENVELOPE_OPENED_BY_SENGVE');

            setTimeout(() => {
                envelopeScreen.classList.add('animate__animated', 'animate__fadeOut');
                setTimeout(() => {
                    envelopeScreen.classList.add('d-none');
                    mainContent.classList.remove('d-none');
                    mainContent.classList.add('animate__animated', 'animate__fadeIn');
                    
                    // Guarantee only countdown-card is visible initially
                    document.querySelectorAll('#main-content .proposal-card').forEach(card => {
                        if (card.id === 'countdown-card') {
                            card.classList.remove('d-none');
                            card.style.display = '';
                        } else {
                            card.classList.add('d-none');
                            card.style.display = 'none';
                        }
                    });

                    window.scrollTo({ top: 0, behavior: 'instant' });
                    triggerMiniConfetti();
                }, 500);
            }, 1200);
        });
    }

    // ==========================================
    // 7. Live Countdown & Grand Welcoming Mode (October 19)
    // ==========================================
    const daysEl = document.getElementById('cd-days');
    const hoursEl = document.getElementById('cd-hours');
    const minutesEl = document.getElementById('cd-minutes');
    const secondsEl = document.getElementById('cd-seconds');
    const cdBadge = document.getElementById('cd-badge');
    const cdTitle = document.getElementById('cd-title');
    const cdSubtitle = document.getElementById('cd-subtitle');
    const countdownTimerBox = document.getElementById('countdown-timer-box');
    const birthdayWelcomeBox = document.getElementById('birthday-welcome-box');
    const cdDistanceQuote = document.getElementById('cd-distance-quote');
    const startCelebrationBtn = document.getElementById('start-celebration-btn');

    let welcomeCelebrationTriggered = false;

    function updateCountdown() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const targetDate = new Date(currentYear, 9, 19, 0, 0, 0); // Month 9 = October (19th, 00:00:00 midnight)
        
        // URL query param '?preview=welcome' allows instant preview of welcoming mode anytime
        const isPreviewWelcome = window.location.search.includes('preview=welcome');
        const isBirthdayReached = (now >= targetDate) || isPreviewWelcome;

        if (isBirthdayReached) {
            // It is officially October 19th (12:00 AM Midnight & Beyond) OR Preview Mode Active
            if (countdownTimerBox) countdownTimerBox.classList.add('d-none');
            if (birthdayWelcomeBox) birthdayWelcomeBox.classList.remove('d-none');
            if (cdDistanceQuote) cdDistanceQuote.classList.add('d-none');

            if (cdBadge) {
                cdBadge.innerHTML = '<i class="fas fa-crown me-2 text-warning"></i> 🎉 THE WAIT IS OVER: TODAY IS YOUR 26TH BIRTHDAY! 🎂';
                cdBadge.classList.add('border', 'border-warning');
            }
            if (cdTitle) cdTitle.innerHTML = '👑 Welcome to Your 26th Birthday World, Sengve! 🎂✨';
            if (cdSubtitle) cdSubtitle.innerHTML = 'Handcrafted with all my heart across 2,248 km from Chandigarh to Diphu, Assam. 💖';
            if (startCelebrationBtn) startCelebrationBtn.innerHTML = 'Step Inside Your 26th Birthday Surprises! 🎁✨ <i class="fas fa-arrow-right ms-2"></i>';

            if (!welcomeCelebrationTriggered) {
                welcomeCelebrationTriggered = true;
                setTimeout(() => {
                    if (typeof triggerMiniConfetti === 'function') triggerMiniConfetti();
                }, 700);
            }
            return;
        }

        // Live Countdown Mode (Prior to October 19th, 12:00 AM)
        if (countdownTimerBox) countdownTimerBox.classList.remove('d-none');
        if (birthdayWelcomeBox) birthdayWelcomeBox.classList.add('d-none');
        if (cdDistanceQuote) cdDistanceQuote.classList.remove('d-none');

        const diff = targetDate - now;
        if (diff <= 0) return;

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        if (daysEl) daysEl.innerText = String(d).padStart(2, '0');
        if (hoursEl) hoursEl.innerText = String(h).padStart(2, '0');
        if (minutesEl) minutesEl.innerText = String(m).padStart(2, '0');
        if (secondsEl) secondsEl.innerText = String(s).padStart(2, '0');
    }

    setInterval(updateCountdown, 1000);
    updateCountdown();

    // ==========================================
    // 8. Card Navigation Flow
    // ==========================================
    function switchCards(currentId, targetId) {
        const targetCard = document.getElementById(targetId);
        if (!targetCard) return;

        // Strictly guarantee only the target card is visible across #main-content
        document.querySelectorAll('#main-content .proposal-card').forEach(card => {
            if (card.id === targetId) {
                card.classList.remove('d-none');
                card.style.display = '';
            } else {
                card.classList.add('d-none');
                card.style.display = 'none';
            }
        });

        targetCard.scrollTop = 0;
        window.scrollTo({ top: 0, behavior: 'instant' });

        if (targetId === 'cake-card') {
            setTimeout(init3DCake, 60);
        }
    }

    // Back Buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            if (targetId) {
                switchCards(btn.closest('.proposal-card')?.id, targetId);
            }
        });
    });

    if (startCelebrationBtn) {
        startCelebrationBtn.addEventListener('click', () => {
            switchCards('countdown-card', 'cake-card');
            if (!isPlaying) {
                startRomanticMusic();
            }
        });
    }

    // ==========================================
    // 9. Interactive 3D Realistic Rotating Cake (Three.js)
    // Modeled faithfully to luxury cream 3-tier celebration cake:
    // Natural cream frosting, scalloped pearl piping, fresh strawberries,
    // pastel cream-yellow roses, fern foliage, and "Sengve Rongpharpi • 26th Birthday"
    // ==========================================
    let cake3DInitialized = false;
    let cakeScene, cakeCamera, cakeRenderer, cakeGroup;
    let cake3DCandles = [];
    let autoRotateCake = true;
    let isDraggingCake = false;
    let dragPreviousX = 0;
    let autoRotateResumeTimeout = null;

    function resizeCake3D() {
        const container = document.getElementById('cake-3d-canvas-container');
        if (!container || !cakeRenderer || !cakeCamera) return;
        const width = container.clientWidth || 360;
        const height = container.clientHeight || 340;
        cakeCamera.aspect = width / height;

        // Dynamic responsive camera distance & framing across mobile, tablet, and desktop
        if (width < 340) {
            cakeCamera.position.set(0, 3.4, 11.6);
        } else if (width < 420) {
            cakeCamera.position.set(0, 3.5, 10.6);
        } else if (width < 540) {
            cakeCamera.position.set(0, 3.5, 9.8);
        } else {
            cakeCamera.position.set(0, 3.6, 9.2);
        }
        cakeCamera.lookAt(0, 1.7, 0);

        cakeCamera.updateProjectionMatrix();
        cakeRenderer.setSize(width, height);
    }

    function init3DCake() {
        const container = document.getElementById('cake-3d-canvas-container');
        if (!container || typeof THREE === 'undefined') return;

        if (cake3DInitialized) {
            resizeCake3D();
            return;
        }

        const width = container.clientWidth || 420;
        const height = container.clientHeight || 380;

        // 1. Scene, Camera, Renderer
        cakeScene = new THREE.Scene();
        cakeCamera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
        cakeCamera.position.set(0, 3.6, 9.2);
        cakeCamera.lookAt(0, 1.7, 0);

        cakeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        cakeRenderer.setSize(width, height);
        cakeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        cakeRenderer.shadowMap.enabled = true;
        cakeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.innerHTML = '';
        container.appendChild(cakeRenderer.domElement);

        // 2. Balanced Studio Lighting (Soft Bakery Cream Tones, No Overexposure)
        const ambientLight = new THREE.AmbientLight(0xfff5ea, 0.45);
        cakeScene.add(ambientLight);

        // Key Light (Warm top-front sunlight casting soft shadows)
        const keyLight = new THREE.DirectionalLight(0xfffaec, 0.88);
        keyLight.position.set(5.5, 9.5, 7.5);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        keyLight.shadow.bias = -0.0005;
        keyLight.shadow.camera.near = 1;
        keyLight.shadow.camera.far = 25;
        keyLight.shadow.camera.left = -5;
        keyLight.shadow.camera.right = 5;
        keyLight.shadow.camera.top = 6;
        keyLight.shadow.camera.bottom = -2;
        cakeScene.add(keyLight);

        // Fill Light (Soft subtle warm bounce from left to soften shadows)
        const fillLight = new THREE.DirectionalLight(0xffe6eb, 0.35);
        fillLight.position.set(-6, 5, -2);
        cakeScene.add(fillLight);

        // Rim Light (Warm golden top backlight to highlight top tier and topper)
        const rimLight = new THREE.DirectionalLight(0xfff0c2, 0.45);
        rimLight.position.set(0, 8, -6);
        cakeScene.add(rimLight);

        // 3. Turntable Cake Group
        cakeGroup = new THREE.Group();
        cakeScene.add(cakeGroup);

        // --- Platter / Base Board ---
        const boardMat = new THREE.MeshStandardMaterial({
            color: 0xfcfbf8,
            roughness: 0.25,
            metalness: 0.05
        });
        const board = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.25, 0.16, 64), boardMat);
        board.position.y = 0.08;
        board.receiveShadow = true;
        cakeGroup.add(board);

        const goldBoardRim = new THREE.Mesh(
            new THREE.TorusGeometry(3.2, 0.038, 16, 64),
            new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.22 })
        );
        goldBoardRim.rotation.x = Math.PI / 2;
        goldBoardRim.position.y = 0.16;
        cakeGroup.add(goldBoardRim);

        // --- Procedural Bakery Cream Texture Generator ---
        function createBakeryCreamTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');

            // Rich warm ivory bakery cream gradient
            const grad = ctx.createLinearGradient(0, 0, 0, 512);
            grad.addColorStop(0, '#fdfaf5');
            grad.addColorStop(0.5, '#f8f3ea');
            grad.addColorStop(1, '#f1ebe0');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 1024, 512);

            // Subtle spatula horizontal strokes for genuine artisanal frosting finish
            ctx.strokeStyle = 'rgba(232, 221, 208, 0.45)';
            ctx.lineWidth = 4;
            for (let y = 14; y < 512; y += 18) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                for (let x = 0; x <= 1024; x += 64) {
                    const offsetY = Math.sin((x / 1024) * Math.PI * 4 + y) * 2;
                    ctx.lineTo(x, y + offsetY);
                }
                ctx.stroke();
            }

            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            return texture;
        }

        const bakeryCreamTexture = createBakeryCreamTexture();

        const creamMat = new THREE.MeshStandardMaterial({
            color: 0xfdfbf7,
            map: bakeryCreamTexture,
            roughness: 0.62,
            metalness: 0.02
        });

        const topCapCreamMat = new THREE.MeshStandardMaterial({
            color: 0xfcf8f1,
            roughness: 0.65,
            metalness: 0.02
        });

        const goldMat = new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            metalness: 0.88,
            roughness: 0.22
        });

        // Piped Shell / Bead Border helper
        function addPipedCreamBorder(radius, yPos, count, pearlScale = 1) {
            const pearlGeo = new THREE.SphereGeometry(0.065 * pearlScale, 14, 14);
            pearlGeo.scale(1, 0.85, 1.25);
            const pearlMat = new THREE.MeshStandardMaterial({
                color: 0xfffcf5,
                roughness: 0.5,
                metalness: 0.02
            });

            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const pearl = new THREE.Mesh(pearlGeo, pearlMat);
                pearl.position.set(Math.cos(angle) * radius, yPos, Math.sin(angle) * radius);
                pearl.rotation.y = -angle;
                pearl.castShadow = true;
                pearl.receiveShadow = true;
                cakeGroup.add(pearl);
            }
        }

        // --- PROCEDURAL 3D STRAWBERRY CREATOR ---
        function create3DStrawberry(scale = 1, tiltZ = 0) {
            const strawberry = new THREE.Group();

            // 1. Organic tapered strawberry shape (lathe)
            const points = [];
            points.push(new THREE.Vector2(0.01, 0.34));
            points.push(new THREE.Vector2(0.13, 0.31));
            points.push(new THREE.Vector2(0.20, 0.22));
            points.push(new THREE.Vector2(0.22, 0.10));
            points.push(new THREE.Vector2(0.18, -0.06));
            points.push(new THREE.Vector2(0.11, -0.20));
            points.push(new THREE.Vector2(0.02, -0.28));
            const strawGeo = new THREE.LatheGeometry(points, 24);

            const strawMat = new THREE.MeshStandardMaterial({
                color: 0xd9162e,
                roughness: 0.32,
                metalness: 0.05
            });
            const body = new THREE.Mesh(strawGeo, strawMat);
            body.castShadow = true;
            body.receiveShadow = true;
            strawberry.add(body);

            // 2. Tiny golden seeds
            const seedGeo = new THREE.SphereGeometry(0.011, 6, 6);
            seedGeo.scale(0.7, 1.3, 0.7);
            const seedMat = new THREE.MeshStandardMaterial({
                color: 0xffdf78,
                roughness: 0.3
            });
            const rings = [
                { y: 0.21, r: 0.19, count: 9 },
                { y: 0.11, r: 0.22, count: 11 },
                { y: -0.01, r: 0.18, count: 9 },
                { y: -0.11, r: 0.13, count: 7 },
                { y: -0.20, r: 0.07, count: 5 }
            ];
            rings.forEach(ring => {
                for (let i = 0; i < ring.count; i++) {
                    const angle = (i / ring.count) * Math.PI * 2 + ring.y * 4;
                    const seed = new THREE.Mesh(seedGeo, seedMat);
                    seed.position.set(Math.cos(angle) * ring.r, ring.y, Math.sin(angle) * ring.r);
                    seed.rotation.z = -0.2;
                    strawberry.add(seed);
                }
            });

            // 3. Green Leafy Calyx (5 star leaves)
            const calyxMat = new THREE.MeshStandardMaterial({
                color: 0x2e6f3b,
                roughness: 0.55,
                side: THREE.DoubleSide
            });
            for (let j = 0; j < 5; j++) {
                const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), calyxMat);
                const a = (j / 5) * Math.PI * 2;
                leaf.position.set(Math.cos(a) * 0.09, 0.32, Math.sin(a) * 0.09);
                leaf.rotation.x = Math.PI / 2 + 0.35;
                leaf.rotation.z = -a;
                leaf.scale.set(1, 1, 0.18);
                strawberry.add(leaf);
            }

            // Stem
            const stem = new THREE.Mesh(
                new THREE.CylinderGeometry(0.018, 0.022, 0.12, 8),
                new THREE.MeshStandardMaterial({ color: 0x3d703b })
            );
            stem.position.y = 0.38;
            strawberry.add(stem);

            strawberry.scale.set(scale, scale, scale);
            if (tiltZ) strawberry.rotation.z = tiltZ;
            return strawberry;
        }

        // Halved Cut Strawberry (showing juicy white-pink center)
        function create3DStrawberryHalf(scale = 1) {
            const halfGroup = new THREE.Group();

            const outerGeo = new THREE.SphereGeometry(0.24, 16, 16, 0, Math.PI, 0, Math.PI);
            outerGeo.scale(0.85, 1.25, 0.95);
            const outerMat = new THREE.MeshStandardMaterial({ color: 0xd9162e, roughness: 0.32 });
            const outerMesh = new THREE.Mesh(outerGeo, outerMat);
            halfGroup.add(outerMesh);

            const cutCanvas = document.createElement('canvas');
            cutCanvas.width = 256;
            cutCanvas.height = 256;
            const cCtx = cutCanvas.getContext('2d');
            cCtx.fillStyle = '#dc2234';
            cCtx.fillRect(0, 0, 256, 256);

            const cGrad = cCtx.createRadialGradient(128, 128, 10, 128, 128, 120);
            cGrad.addColorStop(0, '#fff4f5');
            cGrad.addColorStop(0.35, '#ffb8c2');
            cGrad.addColorStop(0.75, '#ea3b4f');
            cGrad.addColorStop(1, '#cb1b2c');
            cCtx.fillStyle = cGrad;
            cCtx.beginPath();
            cCtx.ellipse(128, 128, 95, 120, 0, 0, Math.PI * 2);
            cCtx.fill();

            cCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            cCtx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                cCtx.beginPath();
                cCtx.moveTo(128, 128);
                cCtx.lineTo(128 + Math.cos(a) * 55, 128 + Math.sin(a) * 70);
                cCtx.stroke();
            }

            const cutTexture = new THREE.CanvasTexture(cutCanvas);
            const cutFace = new THREE.Mesh(
                new THREE.PlaneGeometry(0.42, 0.58),
                new THREE.MeshStandardMaterial({ map: cutTexture, roughness: 0.4 })
            );
            cutFace.position.z = 0.005;
            halfGroup.add(cutFace);

            const leaf = new THREE.Mesh(
                new THREE.ConeGeometry(0.06, 0.16, 5),
                new THREE.MeshStandardMaterial({ color: 0x2e6f3b, side: THREE.DoubleSide })
            );
            leaf.position.set(0, 0.32, 0);
            leaf.rotation.x = Math.PI / 2;
            leaf.scale.set(1, 1, 0.2);
            halfGroup.add(leaf);

            halfGroup.scale.set(scale, scale, scale);
            return halfGroup;
        }

        // --- PROCEDURAL PASTEL CREAM-YELLOW ROSES & FERN FOLIAGE ---
        function createBakeryRose(scale = 1, tintHex = 0xfffae0) {
            const rose = new THREE.Group();
            const pMat = new THREE.MeshStandardMaterial({
                color: tintHex,
                roughness: 0.45,
                metalness: 0.02,
                side: THREE.DoubleSide
            });

            // Core
            const core = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 12, 12), pMat);
            core.scale.set(1, 1.35, 1);
            rose.add(core);

            // Inner petal ring (4 petals, pale yellow)
            for (let i = 0; i < 4; i++) {
                const p = new THREE.Mesh(new THREE.ConeGeometry(0.18 * scale, 0.26 * scale, 12, 1, true), pMat);
                p.rotation.z = 0.45;
                p.rotation.y = (i * Math.PI) / 2;
                p.position.y = 0.04 * scale;
                rose.add(p);
            }

            // Outer petal ring (6 overlapping petals)
            const outerMat = new THREE.MeshStandardMaterial({
                color: 0xfffcf2,
                roughness: 0.5,
                side: THREE.DoubleSide
            });
            for (let i = 0; i < 6; i++) {
                const p = new THREE.Mesh(new THREE.ConeGeometry(0.25 * scale, 0.34 * scale, 12, 1, true), outerMat);
                p.rotation.z = 0.72;
                p.rotation.y = (i * Math.PI) / 3 + 0.3;
                p.position.y = 0.02 * scale;
                rose.add(p);
            }
            return rose;
        }

        // Delicate Fern Leaf matching the photo
        function createFernFrond(scale = 1) {
            const frond = new THREE.Group();
            const leafMat = new THREE.MeshStandardMaterial({
                color: 0x3d6b46,
                roughness: 0.52,
                side: THREE.DoubleSide
            });

            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * scale, 0.015 * scale, 0.55 * scale, 6), leafMat);
            stem.position.y = 0.25 * scale;
            frond.add(stem);

            for (let i = 0; i < 5; i++) {
                const y = (0.1 + i * 0.09) * scale;
                const leafletL = new THREE.Mesh(new THREE.ConeGeometry(0.04 * scale, 0.18 * scale, 4), leafMat);
                leafletL.position.set(-0.06 * scale, y, 0);
                leafletL.rotation.z = -1.2;
                leafletL.scale.set(1, 1, 0.2);
                frond.add(leafletL);

                const leafletR = new THREE.Mesh(new THREE.ConeGeometry(0.04 * scale, 0.18 * scale, 4), leafMat);
                leafletR.position.set(0.06 * scale, y, 0);
                leafletR.rotation.z = 1.2;
                leafletR.scale.set(1, 1, 0.2);
                frond.add(leafletR);
            }
            return frond;
        }

        // --- TIER 1: Base Tier ---
        const tier1 = new THREE.Mesh(
            new THREE.CylinderGeometry(2.35, 2.35, 1.15, 64),
            [creamMat, topCapCreamMat, topCapCreamMat]
        );
        tier1.position.y = 0.72;
        tier1.castShadow = true;
        tier1.receiveShadow = true;
        cakeGroup.add(tier1);
        addPipedCreamBorder(2.38, 0.19, 44, 1.05);

        // Tier 1 Base Floral & Fresh Strawberry Cluster (Front & Base)
        const t1Garnish = new THREE.Group();
        t1Garnish.position.set(-0.7, 0.28, 2.15);
        t1Garnish.rotation.y = 0.2;

        // Pastel cream roses
        t1Garnish.add(createBakeryRose(1.15, 0xfffae0));
        const r1b = createBakeryRose(0.9, 0xfff3c4);
        r1b.position.set(0.42, 0.02, 0.12);
        t1Garnish.add(r1b);

        // Fresh Strawberries at base
        const straw1 = create3DStrawberry(0.95, -0.3);
        straw1.position.set(-0.45, 0.05, 0.22);
        t1Garnish.add(straw1);

        const straw1Half = create3DStrawberryHalf(0.9);
        straw1Half.position.set(0.85, 0.02, 0.08);
        straw1Half.rotation.y = -0.4;
        straw1Half.rotation.x = -0.2;
        t1Garnish.add(straw1Half);

        // Fern fronds
        const f1a = createFernFrond(1.1);
        f1a.position.set(-0.55, 0.05, -0.1);
        f1a.rotation.z = -1.1;
        f1a.rotation.y = 0.3;
        t1Garnish.add(f1a);

        const f1b = createFernFrond(1.0);
        f1b.position.set(0.65, 0.05, -0.1);
        f1b.rotation.z = 1.0;
        t1Garnish.add(f1b);

        cakeGroup.add(t1Garnish);

        // --- TIER 2: Middle Tier ("Sengve Rongpharpi 26th Birthday") ---
        const textCanvas = document.createElement('canvas');
        textCanvas.width = 2048;
        textCanvas.height = 512;
        const ctx = textCanvas.getContext('2d');

        // Warm cream background matching the other tiers
        const t2Grad = ctx.createLinearGradient(0, 0, 0, 512);
        t2Grad.addColorStop(0, '#fdfaf5');
        t2Grad.addColorStop(0.5, '#f8f3ea');
        t2Grad.addColorStop(1, '#f1ebe0');
        ctx.fillStyle = t2Grad;
        ctx.fillRect(0, 0, 2048, 512);

        // Spatula lines
        ctx.strokeStyle = 'rgba(232, 221, 208, 0.45)';
        ctx.lineWidth = 4;
        for (let y = 14; y < 512; y += 18) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x <= 2048; x += 64) {
                const offsetY = Math.sin((x / 2048) * Math.PI * 6 + y) * 2;
                ctx.lineTo(x, y + offsetY);
            }
            ctx.stroke();
        }

        function drawTierInscription(centerX) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Soft luxury gold shadow
            ctx.shadowColor = 'rgba(140, 95, 30, 0.35)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 2;

            // Script name
            ctx.fillStyle = '#9e6d24';
            ctx.font = 'italic 700 84px "Great Vibes", "Dancing Script", cursive, serif';
            ctx.fillText('Sengve Rongpharpi', centerX, 205);

            // 26th Birthday subtitle
            ctx.shadowBlur = 5;
            ctx.fillStyle = '#b38228';
            ctx.font = '700 42px "Cinzel", "Outfit", sans-serif';
            ctx.fillText('✦ 26th Birthday ✦', centerX, 308);
            ctx.restore();
        }

        drawTierInscription(1024);
        drawTierInscription(0);
        drawTierInscription(2048);

        const tier2TextTexture = new THREE.CanvasTexture(textCanvas);
        tier2TextTexture.wrapS = THREE.RepeatWrapping;

        const tier2SideMat = new THREE.MeshStandardMaterial({
            map: tier2TextTexture,
            roughness: 0.62,
            metalness: 0.02
        });

        const tier2 = new THREE.Mesh(
            new THREE.CylinderGeometry(1.75, 1.75, 1.05, 64),
            [tier2SideMat, topCapCreamMat, topCapCreamMat]
        );
        tier2.position.y = 1.82;
        tier2.castShadow = true;
        tier2.receiveShadow = true;
        tier2.rotation.y = Math.PI / 2;
        cakeGroup.add(tier2);
        addPipedCreamBorder(1.78, 1.34, 36, 0.95);

        // Tier 2 Right-Front Cascading Flowers & Strawberries
        const t2Garnish = new THREE.Group();
        t2Garnish.position.set(1.45, 1.55, 0.95);
        t2Garnish.rotation.y = 0.55;

        // Pastel cream roses
        t2Garnish.add(createBakeryRose(0.98, 0xfffae0));
        const r2b = createBakeryRose(0.85, 0xfff4cc);
        r2b.position.set(0.28, -0.22, 0.12);
        t2Garnish.add(r2b);

        // Fresh Strawberries cascading
        const straw2a = create3DStrawberry(0.9, 0.35);
        straw2a.position.set(-0.25, -0.15, 0.2);
        t2Garnish.add(straw2a);

        const straw2Half = create3DStrawberryHalf(0.85);
        straw2Half.position.set(0.35, 0.18, 0.05);
        straw2Half.rotation.y = 0.6;
        t2Garnish.add(straw2Half);

        // Fern fronds
        const f2a = createFernFrond(0.95);
        f2a.position.set(0.35, 0.1, -0.05);
        f2a.rotation.z = 0.85;
        t2Garnish.add(f2a);

        const f2b = createFernFrond(0.85);
        f2b.position.set(-0.3, -0.3, 0.08);
        f2b.rotation.z = -1.1;
        t2Garnish.add(f2b);

        cakeGroup.add(t2Garnish);

        // --- TIER 3: Top Tier ---
        const tier3 = new THREE.Mesh(
            new THREE.CylinderGeometry(1.15, 1.15, 0.95, 64),
            [creamMat, topCapCreamMat, topCapCreamMat]
        );
        tier3.position.y = 2.82;
        tier3.castShadow = true;
        tier3.receiveShadow = true;
        cakeGroup.add(tier3);
        addPipedCreamBorder(1.18, 2.39, 28, 0.85);

        // Piped cream dollops on top rim
        addPipedCreamBorder(1.12, 3.31, 24, 0.75);

        // Top Tier Crown Bouquet (Cream Roses + Fresh Strawberries around topper)
        const topGarnish = new THREE.Group();
        topGarnish.position.set(0, 3.34, 0.2);

        // Center pastel cream rose
        topGarnish.add(createBakeryRose(0.95, 0xfffae0));

        // Flanking roses
        const r3a = createBakeryRose(0.82, 0xfff4cc);
        r3a.position.set(-0.42, 0.02, 0.08);
        topGarnish.add(r3a);

        const r3b = createBakeryRose(0.82, 0xfff4cc);
        r3b.position.set(0.42, 0.02, 0.08);
        topGarnish.add(r3b);

        // Fresh Strawberries at top
        const strawTopL = create3DStrawberry(0.85, -0.25);
        strawTopL.position.set(-0.25, 0.05, 0.28);
        topGarnish.add(strawTopL);

        const strawTopR = create3DStrawberry(0.85, 0.25);
        strawTopR.position.set(0.25, 0.05, 0.28);
        topGarnish.add(strawTopR);

        const strawTopHalf = create3DStrawberryHalf(0.8);
        strawTopHalf.position.set(0, 0.04, 0.38);
        strawTopHalf.rotation.x = -0.3;
        topGarnish.add(strawTopHalf);

        // Fern fronds
        const f3a = createFernFrond(0.9);
        f3a.position.set(-0.55, 0.02, -0.05);
        f3a.rotation.z = -0.9;
        topGarnish.add(f3a);

        const f3b = createFernFrond(0.9);
        f3b.position.set(0.55, 0.02, -0.05);
        f3b.rotation.z = 0.9;
        topGarnish.add(f3b);

        cakeGroup.add(topGarnish);

        // --- GOLDEN HOOP CAKE TOPPER ---
        const topperGroup = new THREE.Group();
        topperGroup.position.set(0, 4.08, -0.15);

        const goldRing = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.045, 16, 64), goldMat);
        topperGroup.add(goldRing);

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.65, 12), goldMat);
        stem.position.y = -0.95;
        topperGroup.add(stem);

        const topperCanvas = document.createElement('canvas');
        topperCanvas.width = 512;
        topperCanvas.height = 512;
        const tCtx = topperCanvas.getContext('2d');
        tCtx.clearRect(0, 0, 512, 512);

        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';
        tCtx.fillStyle = '#b8860b';
        tCtx.font = 'italic 700 82px "Great Vibes", "Playfair Display", cursive, serif';
        tCtx.fillText('Happy', 256, 195);
        tCtx.fillText('Birthday', 256, 275);
        tCtx.font = '700 48px "Cinzel", "Outfit", sans-serif';
        tCtx.fillText('★ 26 ★', 256, 355);

        const topperTexture = new THREE.CanvasTexture(topperCanvas);
        const topperSignMat = new THREE.MeshStandardMaterial({
            map: topperTexture,
            transparent: true,
            side: THREE.DoubleSide,
            roughness: 0.3,
            metalness: 0.6
        });
        const topperSign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), topperSignMat);
        topperGroup.add(topperSign);
        cakeGroup.add(topperGroup);

        // --- 3 REALISTIC GOLDEN SPIRAL CANDLES ON TOP ---
        const candleConfigs = [
            { x: -0.45, z: 0.45 },
            { x: 0, z: 0.65 },
            { x: 0.45, z: 0.45 }
        ];

        cake3DCandles = [];

        candleConfigs.forEach((cfg, idx) => {
            const candleGroup = new THREE.Group();
            candleGroup.position.set(cfg.x, 3.32, cfg.z);

            const cBodyMat = new THREE.MeshStandardMaterial({ color: 0xfffbf0, roughness: 0.35, metalness: 0.08 });
            const cBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.65, 16), cBodyMat);
            cBody.position.y = 0.325;
            candleGroup.add(cBody);

            const spiral = new THREE.Mesh(
                new THREE.TorusGeometry(0.048, 0.012, 8, 32),
                goldMat
            );
            spiral.position.y = 0.35;
            spiral.rotation.x = 0.4;
            candleGroup.add(spiral);

            const wick = new THREE.Mesh(
                new THREE.CylinderGeometry(0.01, 0.01, 0.1, 8),
                new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
            );
            wick.position.y = 0.7;
            candleGroup.add(wick);

            const flameGeo = new THREE.SphereGeometry(0.065, 12, 12);
            flameGeo.scale(0.85, 1.7, 0.85);
            const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd000 });
            const flame = new THREE.Mesh(flameGeo, flameMat);
            flame.position.y = 0.83;
            candleGroup.add(flame);

            const haloGeo = new THREE.SphereGeometry(0.09, 12, 12);
            haloGeo.scale(0.85, 1.7, 0.85);
            const haloMat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.65 });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.position.y = 0.83;
            candleGroup.add(halo);

            const pLight = new THREE.PointLight(0xffa500, 1.2, 4.0);
            pLight.position.set(0, 0.85, 0);
            candleGroup.add(pLight);

            const hitGeo = new THREE.SphereGeometry(0.35, 8, 8);
            const hitMat = new THREE.MeshBasicMaterial({ visible: false });
            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.position.y = 0.65;
            hitMesh.userData = { isCandleHit: true, index: idx };
            candleGroup.add(hitMesh);

            cakeGroup.add(candleGroup);

            cake3DCandles.push({
                group: candleGroup,
                flame,
                halo,
                pLight,
                hitMesh,
                blown: false
            });
        });

        // 4. Drag-to-Rotate 360 Interaction
        const dom = cakeRenderer.domElement;

        function onPointerDown(e) {
            isDraggingCake = true;
            dragPreviousX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            autoRotateCake = false;
            if (autoRotateResumeTimeout) clearTimeout(autoRotateResumeTimeout);
        }

        function onPointerMove(e) {
            if (!isDraggingCake) return;
            const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            const deltaX = clientX - dragPreviousX;
            dragPreviousX = clientX;
            cakeGroup.rotation.y += deltaX * 0.009;
        }

        function onPointerUp() {
            if (!isDraggingCake) return;
            isDraggingCake = false;
            autoRotateResumeTimeout = setTimeout(() => {
                autoRotateCake = true;
            }, 3000);
        }

        dom.addEventListener('mousedown', onPointerDown);
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);

        dom.addEventListener('touchstart', onPointerDown, { passive: true });
        window.addEventListener('touchmove', onPointerMove, { passive: true });
        window.addEventListener('touchend', onPointerUp);

        // Raycasting for Candle Taps
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        dom.addEventListener('click', (e) => {
            const rect = dom.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, cakeCamera);
            const hitMeshes = cake3DCandles.map(c => c.hitMesh);
            const intersects = raycaster.intersectObjects(hitMeshes, false);

            if (intersects.length > 0) {
                const hitIdx = intersects[0].object.userData.index;
                blowSingle3DCandle(hitIdx);
            }
        });

        // Auto-spin toggle button
        const toggleSpinBtn = document.getElementById('toggle-cake-spin');
        if (toggleSpinBtn) {
            toggleSpinBtn.addEventListener('click', () => {
                autoRotateCake = !autoRotateCake;
                toggleSpinBtn.innerHTML = autoRotateCake
                    ? '<i class="fas fa-pause me-1"></i> Pause Spin'
                    : '<i class="fas fa-rotate me-1"></i> Auto-Spin 360°';
            });
        }

        window.addEventListener('resize', resizeCake3D);
        window.addEventListener('orientationchange', () => {
            setTimeout(resizeCake3D, 200);
        });
        if (window.ResizeObserver && container) {
            const ro = new ResizeObserver(() => resizeCake3D());
            ro.observe(container);
        }

        // 5. Animation Loop
        let clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            const time = clock.getElapsedTime();

            if (autoRotateCake && !isDraggingCake) {
                cakeGroup.rotation.y += 0.0065;
            }

            // Candle flame flicker
            cake3DCandles.forEach((c, i) => {
                if (!c.blown) {
                    const flick = Math.sin(time * 14 + i * 2) * 0.12 + Math.cos(time * 23 + i) * 0.08;
                    c.flame.scale.set(0.85 + flick * 0.5, 1.7 + flick * 0.9, 0.85 + flick * 0.5);
                    c.halo.scale.set(0.85 + flick * 0.6, 1.7 + flick * 1.0, 0.85 + flick * 0.6);
                    c.pLight.intensity = 1.1 + flick * 0.5;
                }
            });

            cakeRenderer.render(cakeScene, cakeCamera);
        }

        animate();
        cake3DInitialized = true;
    }

    function blowSingle3DCandle(idx) {
        const c = cake3DCandles[idx];
        if (!c || c.blown) return;

        c.blown = true;
        c.flame.visible = false;
        c.halo.visible = false;
        c.pLight.intensity = 0;

        playCrystalChime('E5', 0.4);
        triggerMiniConfetti();

        const unblownCount = cake3DCandles.filter(item => !item.blown).length;
        const candleStatus = document.getElementById('candle-status');

        if (unblownCount > 0) {
            candleStatus.innerHTML = `<i class="fas fa-fire text-warning me-1"></i> ${unblownCount} candle${unblownCount > 1 ? 's' : ''} left to make your wish, Sengve!`;
        } else {
            onAll3DCandlesBlown();
        }
    }

    function onAll3DCandlesBlown() {
        const candleStatus = document.getElementById('candle-status');
        candleStatus.innerHTML = `🎉 <strong>All candles blown! Happy 26th Birthday, Sengve Rongpharpi! ✨🎂</strong>`;
        candleStatus.style.background = 'rgba(16, 185, 129, 0.2)';
        candleStatus.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        candleStatus.style.color = '#75fbb3';

        triggerGrandConfetti();
        triggerFireworks();
        if (typeof playSfx === 'function') playSfx('fanfare');

        showToast("Wish Made! Happy 26th Birthday Sengve! 💖✨");
        logDbEvent('CANDLES_BLOWN_BY_SENGVE_26TH');

        // Hide blow-all button
        const blowAllBtn = document.getElementById('blow-all-btn');
        if (blowAllBtn) blowAllBtn.parentElement.classList.add('d-none');

        // Reveal Celebration Hub with Surprise button
        const hub = document.getElementById('cake-celebration-hub');
        const afterCakeBtn = document.getElementById('after-cake-btn');
        if (hub) {
            hub.classList.remove('d-none');
            hub.classList.add('animate__animated', 'animate__fadeInUp');
        } else if (afterCakeBtn) {
            afterCakeBtn.classList.remove('d-none');
        }
    }

    const blowAllBtn = document.getElementById('blow-all-btn');
    if (blowAllBtn) {
        blowAllBtn.addEventListener('click', () => {
            cake3DCandles.forEach((c) => {
                c.blown = true;
                c.flame.visible = false;
                c.halo.visible = false;
                c.pLight.intensity = 0;
            });
            onAll3DCandlesBlown();
        });
    }

    const afterCakeBtn = document.getElementById('after-cake-btn');

    // Step 2 -> Step 2.4 (Cake -> Teddy Bear Surprise)
    if (afterCakeBtn) {
        afterCakeBtn.addEventListener('click', () => {
            switchCards('cake-card', 'teddy-card');
        });
    }

    // Step 2.4 -> Step 2.5 (Teddy Bear -> Rose Bouquet Surprise)
    const toBouquetBtn = document.getElementById('to-bouquet-btn');
    if (toBouquetBtn) {
        toBouquetBtn.addEventListener('click', () => {
            switchCards('teddy-card', 'gift-card');
        });
    }

    // Step 2.5 -> Step 3 (Rose Bouquet -> Distance Map)
    const toMapBtn = document.getElementById('to-map-btn');
    if (toMapBtn) {
        toMapBtn.addEventListener('click', () => {
            switchCards('gift-card', 'map-card');
        });
    }

    // ==========================================
    // 9.2 Interactive Plush Teddy Bear & Luxury Rose Bouquet
    // ==========================================
    const hugTeddyBtn = document.getElementById('hug-teddy-btn');
    const teddySpeech = document.getElementById('teddy-speech');
    const teddyBox = document.getElementById('teddy-box');

    const triggerTeddyHug = (e) => {
        if (e) e.stopPropagation();
        triggerMiniConfetti();
        if (typeof playSfx === 'function') playSfx('bell');

        if (teddySpeech) {
            teddySpeech.innerText = "Sengve, sending you the biggest, warmest bear hug from Chandigarh! 🥰🧸✨";
            teddySpeech.classList.remove('animate__animated', 'animate__bounce');
            void teddySpeech.offsetWidth;
            teddySpeech.classList.add('animate__animated', 'animate__bounce');
        }

        showToast("Giant teddy bear hug sent to Sengve! 🧸❤️");
        logDbEvent('TEDDY_HUG_RECEIVED_BY_SENGVE');
    };

    if (hugTeddyBtn) hugTeddyBtn.addEventListener('click', triggerTeddyHug);
    if (teddyBox) teddyBox.addEventListener('click', triggerTeddyHug);

    // Luxury Rose Bouquet Handlers
    const bouquetBox = document.getElementById('bouquet-box');
    const receiveBouquetBtn = document.getElementById('receive-bouquet-btn');
    const flowerCardNote = document.getElementById('flower-card-note');

    function triggerFlowerShower() {
        if (typeof confetti === 'function') {
            const flowerColors = ['#ff007f', '#ff758c', '#ffccd5', '#ffd700', '#ff4d6d'];
            confetti({
                particleCount: 55,
                spread: 90,
                origin: { y: 0.55 },
                colors: flowerColors
            });
        }
    }

    const triggerReceiveBouquet = (e) => {
        if (e) e.stopPropagation();
        triggerFlowerShower();
        triggerFireworks();
        if (typeof playSfx === 'function') playSfx('fanfare');

        if (flowerCardNote) {
            flowerCardNote.classList.remove('d-none');
            flowerCardNote.classList.remove('animate__animated', 'animate__fadeInUp');
            void flowerCardNote.offsetWidth;
            flowerCardNote.classList.add('animate__animated', 'animate__fadeInUp');
        }

        showToast("Bouquet of 99 fresh roses accepted! 💐🌹✨");
        logDbEvent('BOUQUET_ACCEPTED_BY_SENGVE');
    };

    if (receiveBouquetBtn) receiveBouquetBtn.addEventListener('click', triggerReceiveBouquet);
    if (bouquetBox) bouquetBox.addEventListener('click', triggerReceiveBouquet);

    // Step 3 -> Step 4 (Map -> Memories / Photo Gallery)
    const toMemoriesBtn = document.getElementById('to-memories-btn');
    if (toMemoriesBtn) {
        toMemoriesBtn.addEventListener('click', () => {
            switchCards('map-card', 'memories-card');
        });
    }

    // ==========================================
    // 10. Photo Gallery Lightbox Interactivity (NEW)
    // ==========================================
    const photoCards = document.querySelectorAll('.gallery-photo-card');
    const photoModal = document.getElementById('photo-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const closePhotoModal = document.getElementById('close-photo-modal');

    photoCards.forEach(card => {
        card.addEventListener('click', () => {
            const imgEl = card.querySelector('.gallery-img');
            const caption = card.dataset.caption || "";
            if (imgEl && photoModal) {
                lightboxImg.src = imgEl.src;
                lightboxCaption.innerText = caption;
                photoModal.classList.remove('d-none');
                logDbEvent('PHOTO_VIEWED_BY_SENGVE', { photoId: card.dataset.photo, caption });
            }
        });
    });

    // Allow clicking teddy and bouquet photos to view in full-screen lightbox
    const teddyMainImg = document.getElementById('teddy-main-img');
    if (teddyMainImg && photoModal && lightboxImg && lightboxCaption) {
        teddyMainImg.addEventListener('click', (e) => {
            e.stopPropagation();
            lightboxImg.src = teddyMainImg.src;
            lightboxCaption.innerText = "Plush White Teddy Bear with a Velvet Red Rose for Sengve 🧸🌹";
            photoModal.classList.remove('d-none');
            logDbEvent('TEDDY_PHOTO_FULLSCREEN_VIEWED');
        });
    }

    const bouquetMainImg = document.getElementById('bouquet-main-img');
    if (bouquetMainImg && photoModal && lightboxImg && lightboxCaption) {
        bouquetMainImg.addEventListener('click', (e) => {
            e.stopPropagation();
            lightboxImg.src = bouquetMainImg.src;
            lightboxCaption.innerText = "Heart-Shaped Bouquet of 99 Luxury Red Velvet Roses for Sengve 💐❤️";
            photoModal.classList.remove('d-none');
            logDbEvent('BOUQUET_PHOTO_FULLSCREEN_VIEWED');
        });
    }

    if (closePhotoModal) {
        closePhotoModal.addEventListener('click', () => {
            photoModal.classList.add('d-none');
        });
    }

    if (photoModal) {
        photoModal.addEventListener('click', (e) => {
            if (e.target === photoModal) {
                photoModal.classList.add('d-none');
            }
        });
    }

    // Step 5 -> Step 6 (Photo Gallery -> Letters)
    const toLettersBtn = document.getElementById('to-letters-btn');
    if (toLettersBtn) {
        toLettersBtn.addEventListener('click', () => {
            switchCards('memories-card', 'letters-card');
        });
    }

    // ==========================================
    // 11. "Open When..." Letters (For Sengve Rongpharpi)
    // ==========================================
    const lettersData = {
        birthday: {
            tag: "Birthday Letter for Sengve 🎂✨",
            title: "Happy Birthday to You, Sengve! 🎉❤️",
            body: `Hey, birthday girl! ❤️🎂🥳<br><br>First of all, <strong>Happy Birthday to you, Sengve!</strong> 🎉✨<br><br>You know, it's been more than a year since we became friends, and even though work, life, and 2,248 km have kept us from catching up in person yet, I’m truly so glad and grateful that we connected. ❤️ Sometimes, people come into our lives without any special reason, but somehow, they become a part of our daily lives and make everything a little more special.<br><br>On your birthday, I just want to wish you lots of happiness, success, good health, and all the beautiful things you deserve. May you always have reasons to smile, people who genuinely care about you, and the courage to achieve everything you dream of. ✨<br><br>And yes, whenever the timing is right and I get the chance to come back to my hometown, it'll be so great to finally hang out, share good food, and laugh about how we managed to stay such wonderful friends for so long before meeting in person! 😂❤️<br><br>Until then, please keep smiling, keep being yourself, and keep that beautiful energy alive. Enjoy your special day to the fullest, Sengve! Sending you lots of happiness and warm wishes from Chandigarh. May this new chapter of your life be even more beautiful than the last one. 🌸🎂✨`
        },
        confession: {
            tag: "From the Deepest Corner of My Heart 💖",
            title: "The Truth I've Been Keeping Inside",
            body: "Sengve, somewhere between our random jokes, our late-night talks, and the way you listen to me, I fell completely in love with you. You're not just someone I like talking to — you're the person I want by my side in every chapter of life."
        },
        distance: {
            tag: "Chandigarh to Diphu ✈️",
            title: "Why 2,248 Kilometers Means Nothing",
            body: "Being in Chandigarh while you are in Diphu taught me that physical distance is only geographical. When two hearts beat in sync, miles only make the bond stronger. Distance has only shown me how certain I am about you."
        },
        promise: {
            tag: "My Solemn Promise ✨",
            title: "What I Promise You, Sengve",
            body: "If you give me the honor of being your partner, I promise to always respect you, support your dreams, make you laugh when you're down, and give you the biggest, warmest hugs every time we meet. I want to celebrate every birthday by your side."
        }
    };

    const letterBoxes = document.querySelectorAll('.letter-box');
    const letterModal = document.getElementById('letter-modal');
    const modalLetterTag = document.getElementById('modal-letter-tag');
    const modalLetterTitle = document.getElementById('modal-letter-title');
    const modalLetterBody = document.getElementById('modal-letter-body');
    const closeLetterBtn = document.getElementById('close-letter-btn');

    letterBoxes.forEach(box => {
        box.addEventListener('click', () => {
            const letterKey = box.dataset.letter;
            const data = lettersData[letterKey];
            if (!data) return;

            modalLetterTag.innerText = data.tag;
            modalLetterTitle.innerText = data.title;
            modalLetterBody.innerHTML = data.body;

            letterModal.classList.remove('d-none');
            triggerMiniConfetti();

            logDbEvent('LETTER_READ_BY_SENGVE', { letter: letterKey, title: data.title });
        });
    });

    if (closeLetterBtn) {
        closeLetterBtn.addEventListener('click', () => {
            letterModal.classList.add('d-none');
        });
    }

    const toVouchersBtn = document.getElementById('to-vouchers-btn');
    if (toVouchersBtn) {
        toVouchersBtn.addEventListener('click', () => {
            switchCards('letters-card', 'vouchers-card');
        });
    }

    // ==========================================
    // 12. Sengve's Privileges & Direct MongoDB Claim
    // ==========================================
    const claimBtns = document.querySelectorAll('.claim-btn');

    claimBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const voucherName = btn.dataset.voucher;
            const voucherCard = btn.closest('.voucher-card');

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Saving...';

            // Insert directly into MongoDB
            await claimVoucherInDb(voucherName);

            btn.innerHTML = '<i class="fas fa-check me-1"></i> Claimed & Saved to DB!';
            btn.classList.remove('btn-outline-pink');
            btn.classList.add('btn-success');

            if (voucherCard) {
                voucherCard.classList.add('claimed');
            }

            triggerMiniConfetti();
            playSfx('bell');
            showToast(`Privilege "${voucherName}" locked into database! 🔒❤️`);
        });
    });

    // Restore previously claimed vouchers from localStorage
    try {
        const storedClaims = JSON.parse(localStorage.getItem('sengve_vouchers') || '[]');
        if (Array.isArray(storedClaims)) {
            claimBtns.forEach(btn => {
                if (storedClaims.includes(btn.dataset.voucher)) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-check me-1"></i> Claimed & Saved to DB!';
                    btn.classList.remove('btn-outline-pink');
                    btn.classList.add('btn-success');
                    const voucherCard = btn.closest('.voucher-card');
                    if (voucherCard) voucherCard.classList.add('claimed');
                }
            });
        }
    } catch (e) {}

    const toQuestionBtn = document.getElementById('to-question-btn');
    if (toQuestionBtn) {
        toQuestionBtn.addEventListener('click', () => {
            switchCards('vouchers-card', 'question-card');
        });
    }

    // ==========================================
    // 13. Playful Runaway "No" Button (For Sengve)
    // ==========================================
    const noBtn = document.getElementById('no-btn');
    const yesBtn = document.getElementById('yes-btn');
    const questionCard = document.getElementById('question-card');
    const finalCard = document.getElementById('final-card');

    const funnyMessages = [
        "Take all the time in the world, birthday girl! ❤️",
        "No pressure at all, you are always special to me! ✨",
        "Best friends forever no matter what! 🌸",
        "Diphu & Chandigarh agree: Sengve deserves only smiles today! 😊",
        "Celebrating you is what matters most today! 🎂",
        "Whenever you're ready, I'm always in your corner! 💖"
    ];

    let yesScale = 1;

    const moveNoButton = () => {
        const padding = 30;

        yesScale += 0.1;
        yesBtn.style.transform = `scale(${yesScale})`;

        showToast(funnyMessages[Math.floor(Math.random() * funnyMessages.length)]);

        const maxX = window.innerWidth - noBtn.offsetWidth - padding;
        const maxY = window.innerHeight - noBtn.offsetHeight - padding;
        const randomX = Math.max(padding, Math.random() * maxX);
        const randomY = Math.max(padding, Math.random() * maxY);

        noBtn.style.position = 'fixed';
        noBtn.style.left = `${randomX}px`;
        noBtn.style.top = `${randomY}px`;
        noBtn.style.zIndex = '1000';
    };

    if (noBtn) {
        noBtn.addEventListener('mouseover', moveNoButton);
        noBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            moveNoButton();
        }, { passive: false });
        noBtn.addEventListener('click', (e) => {
            e.preventDefault();
            moveNoButton();
        });
    }

    // ==========================================
    // 14. "YES, I WILL!" Official Proposal Accept (Direct MongoDB Save)
    // ==========================================
    if (yesBtn) {
        yesBtn.addEventListener('click', async () => {
            questionCard.classList.add('d-none');
            finalCard.classList.remove('d-none');
            finalCard.classList.add('animate__animated', 'animate__zoomIn');

            playSfx('fanfare');
            triggerGrandConfetti();
            triggerFireworks();
            showToast("SENGVE SAID YES! Locked into database forever! ❤️💍");

            // Insert YES directly into MongoDB
            await respondProposalInDb("YES");
        });
    }

    // ==========================================
    // 15. Confetti Systems
    // ==========================================
    function triggerMiniConfetti() {
        if (typeof confetti !== 'function') return;
        confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.6 }
        });
    }

    function triggerGrandConfetti() {
        if (typeof confetti !== 'function') return;
        const duration = 12 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 35, spread: 360, ticks: 70, zIndex: 2000 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 55 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    }

    // ==========================================
    // 16. Toast Notification
    // ==========================================
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'custom-toast';
        toast.innerText = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 400);
            }, 2200);
        }, 80);
    }

    // ==========================================
    // 17. 3D Card Parallax Tilt System (Ultra-Premium Micro-Interactions)
    // ==========================================
    const cards = document.querySelectorAll('.proposal-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -6; // Max 6 deg
            const rotateY = ((x - centerX) / centerX) * 6;

            card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)`;
        });
    });

    // ==========================================
    // 18. Atmospheric Canvas: Golden Fireflies & Rose Petals
    // ==========================================
    const canvas = document.getElementById('atmosphere-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        // Golden Stars & Fireflies
        const particles = [];
        const particleCount = window.innerWidth < 768 ? 25 : 45;

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 2 + 0.8,
                color: Math.random() > 0.4 ? 'rgba(249, 203, 40, ' : 'rgba(255, 42, 133, ',
                alpha: Math.random() * 0.7 + 0.3,
                speedX: (Math.random() - 0.5) * 0.4,
                speedY: -Math.random() * 0.5 - 0.1,
                pulse: Math.random() * 0.03 + 0.01
            });
        }

        // Floating Rose Petals & 5-Petal Flower Blossoms
        const petals = [];
        const petalCount = window.innerWidth < 768 ? 8 : 16;
        for (let i = 0; i < petalCount; i++) {
            petals.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 8 + 6,
                speedY: Math.random() * 0.8 + 0.4,
                speedX: Math.sin(Math.random() * 3) * 0.5,
                angle: Math.random() * 360,
                angularSpeed: (Math.random() - 0.5) * 1.5,
                opacity: Math.random() * 0.4 + 0.25
            });
        }

        const flowers = [];
        const flowerCount = window.innerWidth < 768 ? 6 : 12;
        for (let i = 0; i < flowerCount; i++) {
            flowers.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 4 + 6,
                speedY: Math.random() * 0.7 + 0.35,
                speedX: Math.random() * 0.4 - 0.2,
                angle: Math.random() * 360,
                angularSpeed: (Math.random() - 0.5) * 1.2,
                color: Math.random() > 0.5 ? 'rgba(255, 182, 193, ' : 'rgba(255, 105, 180, ',
                alpha: Math.random() * 0.4 + 0.35
            });
        }

        function renderAtmosphere() {
            ctx.clearRect(0, 0, width, height);

            // Draw Golden Fireflies
            particles.forEach(p => {
                p.x += p.speedX;
                p.y += p.speedY;
                p.alpha += Math.sin(Date.now() * p.pulse * 0.05) * 0.01;

                if (p.y < 0) p.y = height;
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;

                ctx.save();
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = `${p.color}${Math.max(0.1, Math.min(1, p.alpha))})`;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ffd700';
                ctx.fill();
                ctx.restore();
            });

            // Draw Drifting Rose Petals
            petals.forEach(pt => {
                pt.y += pt.speedY;
                pt.x += Math.sin(pt.y * 0.015) * 0.8;
                pt.angle += pt.angularSpeed;

                if (pt.y > height + 20) {
                    pt.y = -20;
                    pt.x = Math.random() * width;
                }

                ctx.save();
                ctx.translate(pt.x, pt.y);
                ctx.rotate((pt.angle * Math.PI) / 180);
                ctx.beginPath();
                // Draw petal curve
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(pt.size / 2, -pt.size / 2, pt.size, pt.size / 3, 0, pt.size);
                ctx.bezierCurveTo(-pt.size, pt.size / 3, -pt.size / 2, -pt.size / 2, 0, 0);
                ctx.fillStyle = `rgba(255, 42, 133, ${pt.opacity})`;
                ctx.shadowBlur = 6;
                ctx.shadowColor = 'rgba(255, 0, 127, 0.4)';
                ctx.fill();
                ctx.restore();
            });

            // Draw Drifting 5-Petal Flower Blossoms
            flowers.forEach(fl => {
                fl.y += fl.speedY;
                fl.x += Math.sin(fl.y * 0.01) * 0.7 + fl.speedX;
                fl.angle += fl.angularSpeed;

                if (fl.y > height + 25) {
                    fl.y = -25;
                    fl.x = Math.random() * width;
                }

                ctx.save();
                ctx.translate(fl.x, fl.y);
                ctx.rotate((fl.angle * Math.PI) / 180);
                ctx.fillStyle = `${fl.color}${fl.alpha})`;
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'rgba(255, 105, 180, 0.4)';

                for (let p = 0; p < 5; p++) {
                    ctx.beginPath();
                    ctx.rotate((Math.PI * 2) / 5);
                    ctx.arc(0, fl.radius * 0.65, fl.radius * 0.45, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.beginPath();
                ctx.arc(0, 0, fl.radius * 0.28, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 215, 0, ${Math.min(1, fl.alpha + 0.3)})`;
                ctx.fill();

                ctx.restore();
            });

            requestAnimationFrame(renderAtmosphere);
        }

        renderAtmosphere();
    }
});
