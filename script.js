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
    // 1. API Helper Functions (Direct MongoDB Sync)
    // ==========================================
    async function apiRequest(endpoint, method = 'GET', body = null, headers = {}) {
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
            return await res.json();
        } catch (err) {
            console.warn("Backend sync notice:", err.message);
            return { success: false, fallback: true };
        }
    }

    async function logDbEvent(eventType, details = {}) {
        await apiRequest('/api/event', 'POST', {
            eventType,
            userName: TARGET_NAME,
            details
        });
    }

    async function claimVoucherInDb(voucherName) {
        return await apiRequest('/api/vouchers/claim', 'POST', { voucherName });
    }

    async function respondProposalInDb(answer = 'YES') {
        return await apiRequest('/api/proposal/respond', 'POST', { answer });
    }

    // ==========================================
    // 2. VIP Gatekeeper & Access Control
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
            
            showToast(`Welcome, Sengve Rongpharpi! ❤️ Access Granted.`);

            authScreen.classList.add('animate__animated', 'animate__fadeOut');
            setTimeout(() => {
                authScreen.classList.add('d-none');
                envelopeScreen.classList.remove('d-none');
                envelopeScreen.classList.add('animate__animated', 'animate__fadeIn');
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
    // 4. Audio Controller (Synthesized Romantic Music Box)
    // ==========================================
    const musicToggle = document.getElementById('music-toggle');
    let audioCtx = null;
    let isPlaying = false;
    let musicInterval = null;

    const romanticNotes = [
        261.63, 261.63, 293.66, 261.63, 349.23, 329.63,
        261.63, 261.63, 293.66, 261.63, 392.00, 349.23,
        261.63, 261.63, 523.25, 440.00, 349.23, 329.63, 293.66,
        466.16, 466.16, 440.00, 349.23, 392.00, 349.23,
        329.63, 392.00, 523.25, 659.25, 523.25, 392.00,
        349.23, 440.00, 523.25, 698.46, 523.25, 440.00
    ];

    let noteIndex = 0;

    function playNote(freq, duration = 0.5) {
        if (!audioCtx) return;
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

            gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch (e) {}
    }

    function startRomanticMusic() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        isPlaying = true;
        musicToggle.classList.add('playing');

        if (musicInterval) clearInterval(musicInterval);

        musicInterval = setInterval(() => {
            const freq = romanticNotes[noteIndex % romanticNotes.length];
            playNote(freq, 0.65);
            noteIndex++;
        }, 360);
    }

    function stopRomanticMusic() {
        isPlaying = false;
        musicToggle.classList.remove('playing');
        if (musicInterval) {
            clearInterval(musicInterval);
            musicInterval = null;
        }
    }

    if (musicToggle) {
        musicToggle.addEventListener('click', () => {
            if (isPlaying) {
                stopRomanticMusic();
                showToast("Music paused 🎵");
            } else {
                startRomanticMusic();
                showToast("Playing romantic birthday chimes 🎶✨");
            }
        });
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
                    triggerMiniConfetti();
                }, 500);
            }, 1200);
        });
    }

    // ==========================================
    // 7. Live Countdown to October 19
    // ==========================================
    const daysEl = document.getElementById('cd-days');
    const hoursEl = document.getElementById('cd-hours');
    const minutesEl = document.getElementById('cd-minutes');
    const secondsEl = document.getElementById('cd-seconds');

    function updateCountdown() {
        const now = new Date();
        const currentYear = now.getFullYear();
        let targetDate = new Date(currentYear, 9, 19, 0, 0, 0); // Month 9 = October

        if (now.getMonth() === 9 && now.getDate() > 19) {
            targetDate = new Date(currentYear + 1, 9, 19, 0, 0, 0);
        }

        const diff = targetDate - now;

        if (diff <= 0) {
            if (daysEl) daysEl.innerText = "00";
            if (hoursEl) hoursEl.innerText = "00";
            if (minutesEl) minutesEl.innerText = "00";
            if (secondsEl) secondsEl.innerText = "00";
            return;
        }

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
        const currentCard = document.getElementById(currentId);
        const targetCard = document.getElementById(targetId);

        if (!currentCard || !targetCard) return;

        currentCard.classList.add('animate__animated', 'animate__fadeOutLeft');
        setTimeout(() => {
            currentCard.classList.add('d-none');
            currentCard.classList.remove('animate__animated', 'animate__fadeOutLeft');

            targetCard.classList.remove('d-none');
            targetCard.classList.add('animate__animated', 'animate__fadeInRight');

            setTimeout(() => {
                targetCard.classList.remove('animate__animated', 'animate__fadeInRight');
            }, 500);
        }, 400);
    }

    // Back Buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const currentCard = btn.closest('.proposal-card');
            const targetId = btn.dataset.target;
            const targetCard = document.getElementById(targetId);

            if (currentCard && targetCard) {
                currentCard.classList.add('animate__animated', 'animate__fadeOutRight');
                setTimeout(() => {
                    currentCard.classList.add('d-none');
                    currentCard.classList.remove('animate__animated', 'animate__fadeOutRight');

                    targetCard.classList.remove('d-none');
                    targetCard.classList.add('animate__animated', 'animate__fadeInLeft');

                    setTimeout(() => {
                        targetCard.classList.remove('animate__animated', 'animate__fadeInLeft');
                    }, 500);
                }, 400);
            }
        });
    });

    const startCelebrationBtn = document.getElementById('start-celebration-btn');
    if (startCelebrationBtn) {
        startCelebrationBtn.addEventListener('click', () => {
            switchCards('countdown-card', 'cake-card');
        });
    }

    // ==========================================
    // 9. Interactive Cake & Candle Blowing
    // ==========================================
    const candles = document.querySelectorAll('.candle');
    const candleStatus = document.getElementById('candle-status');
    const afterCakeBtn = document.getElementById('after-cake-btn');
    let blownCount = 0;

    candles.forEach(candle => {
        const blowCandle = () => {
            if (candle.classList.contains('blown')) return;

            candle.classList.add('blown');
            blownCount++;

            playNote(659.25, 0.4);

            if (blownCount < candles.length) {
                const remaining = candles.length - blownCount;
                candleStatus.innerHTML = `<i class="fas fa-fire me-1"></i> ${remaining} candle${remaining > 1 ? 's' : ''} left to blow!`;
            } else {
                candleStatus.innerHTML = `🎉 <strong>All candles blown! Your wish is sent to the stars, Sengve! ✨</strong>`;
                candleStatus.classList.remove('text-warning');
                candleStatus.style.background = 'rgba(16, 185, 129, 0.2)';
                candleStatus.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                candleStatus.style.color = '#75fbb3';

                triggerGrandConfetti();
                showToast("Wish Made! Now let me show you what's in my heart, Sengve 💖");
                logDbEvent('CANDLES_BLOWN_BY_SENGVE');

                if (afterCakeBtn) {
                    afterCakeBtn.classList.remove('d-none');
                    afterCakeBtn.classList.add('animate__animated', 'animate__fadeInUp');
                }
            }
        };

        candle.addEventListener('click', blowCandle);
        candle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            blowCandle();
        }, { passive: false });
    });

    if (afterCakeBtn) {
        afterCakeBtn.addEventListener('click', () => {
            switchCards('cake-card', 'map-card');
        });
    }

    const toMemoriesBtn = document.getElementById('to-memories-btn');
    if (toMemoriesBtn) {
        toMemoriesBtn.addEventListener('click', () => {
            switchCards('map-card', 'memories-card');
        });
    }

    // ==========================================
    // 10. Polaroid Scrapbook Carousel
    // ==========================================
    const memories = [
        {
            icon: 'fa-face-smile-beam',
            color: '#ff65a6',
            caption: '"The effortless way your smile instantly lights up my entire mood, Sengve."'
        },
        {
            icon: 'fa-phone-volume',
            color: '#00d2ff',
            caption: '"Our endless late-night chats that make 2,248 km feel like you are right beside me."'
        },
        {
            icon: 'fa-heart-circle-check',
            color: '#f9cb28',
            caption: '"How you naturally became the first and last person on my mind every single day."'
        },
        {
            icon: 'fa-sparkles',
            color: '#ff2a85',
            caption: '"The kindness and warmth in your soul that made me fall completely for you, Sengve."'
        }
    ];

    let currentMemoryIndex = 0;
    const polaroidCard = document.getElementById('polaroid-display');
    const photoArtIcon = document.getElementById('photo-art-icon');
    const polaroidCaptionText = document.getElementById('polaroid-caption-text');
    const memoryCounter = document.getElementById('memory-counter');
    const prevMemoryBtn = document.getElementById('prev-memory');
    const nextMemoryBtn = document.getElementById('next-memory');

    function updateMemoryCard(index) {
        const mem = memories[index];
        if (polaroidCard) {
            polaroidCard.classList.add('animate__animated', 'animate__flipInX');
            setTimeout(() => {
                polaroidCard.classList.remove('animate__animated', 'animate__flipInX');
            }, 500);
        }

        if (photoArtIcon) {
            photoArtIcon.innerHTML = `<i class="fas ${mem.icon}" style="color: ${mem.color}"></i>`;
        }
        if (polaroidCaptionText) {
            polaroidCaptionText.innerText = mem.caption;
        }
        if (memoryCounter) {
            memoryCounter.innerText = `${index + 1} / ${memories.length}`;
        }
    }

    if (prevMemoryBtn) {
        prevMemoryBtn.addEventListener('click', () => {
            currentMemoryIndex = (currentMemoryIndex - 1 + memories.length) % memories.length;
            updateMemoryCard(currentMemoryIndex);
        });
    }

    if (nextMemoryBtn) {
        nextMemoryBtn.addEventListener('click', () => {
            currentMemoryIndex = (currentMemoryIndex + 1) % memories.length;
            updateMemoryCard(currentMemoryIndex);
        });
    }

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
            tag: "Oct 19 Birthday Special 🎂",
            title: "Happy Birthday, Sengve ❤️",
            body: "Today is the day the world was blessed with you, Sengve. Even though I have to be in Chandigarh working while you celebrate in Diphu, Assam, you are the most special person in my life. May this birthday bring you infinite happiness, laughter, and all the dreams you hold dear. You deserve the best of everything!"
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
            modalLetterBody.innerText = data.body;

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
            showToast(`Privilege "${voucherName}" locked into database! 🔒❤️`);
        });
    });

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
        "Nice try Sengve, but 'No' is not an option! 😉",
        "Error 404: 'No' does not exist between Chandigarh & Diphu!",
        "Diphu server strictly rejected this button!",
        "You can't say No to love on your birthday! 😜",
        "Even the button knows you want to say YES, Sengve!",
        "Try clicking the big glowing YES button instead!"
    ];

    let yesScale = 1;

    const moveNoButton = () => {
        const padding = 30;

        yesScale += 0.12;
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

            triggerGrandConfetti();
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
    // 17. Sparkles Background System
    // ==========================================
    const createSpark = () => {
        if (!sparkContainer) return;
        const spark = document.createElement('div');
        spark.className = 'spark';

        const size = Math.random() * 3 + 1.5;
        spark.style.width = `${size}px`;
        spark.style.height = `${size}px`;

        const startX = Math.random() * window.innerWidth;
        const startY = Math.random() * window.innerHeight;

        spark.style.left = `${startX}px`;
        spark.style.top = `${startY}px`;

        const colors = ['#ff2a85', '#ffd700', '#ffffff', '#ffd166', '#00d2ff'];
        spark.style.background = colors[Math.floor(Math.random() * colors.length)];
        spark.style.boxShadow = `0 0 8px ${spark.style.background}`;

        sparkContainer.appendChild(spark);

        const duration = Math.random() * 3000 + 2000;
        const destinationX = startX + (Math.random() - 0.5) * 150;
        const destinationY = startY - Math.random() * 200;

        const animation = spark.animate([
            { opacity: 0, transform: 'translate(0, 0) scale(0)' },
            { opacity: 0.9, transform: `translate(${(destinationX - startX) / 2}px, ${(destinationY - startY) / 2}px) scale(1)`, offset: 0.5 },
            { opacity: 0, transform: `translate(${destinationX - startX}px, ${destinationY - startY}px) scale(0)` }
        ], {
            duration: duration,
            easing: 'ease-out'
        });

        animation.onfinish = () => spark.remove();
    };

    setInterval(createSpark, 250);
});
