document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const mainContent = document.getElementById('main-content');
    const envelopeWrapper = document.getElementById('envelope-wrapper');
    const envelopeScreen = document.getElementById('envelope-screen');
    const sparkContainer = document.getElementById('spark-container');

    // ==========================================
    // 1. Audio Controller (Synthesized Romantic Music Box)
    // ==========================================
    const musicToggle = document.getElementById('music-toggle');
    let audioCtx = null;
    let isPlaying = false;
    let musicInterval = null;

    const romanticNotes = [
        // Happy Birthday & Romantic melody frequencies (Hz)
        261.63, 261.63, 293.66, 261.63, 349.23, 329.63, // Happy Birthday to you
        261.63, 261.63, 293.66, 261.63, 392.00, 349.23, // Happy Birthday to you
        261.63, 261.63, 523.25, 440.00, 349.23, 329.63, 293.66, // Happy Birthday dear love
        466.16, 466.16, 440.00, 349.23, 392.00, 349.23,  // Happy Birthday to you
        // Romantic chords arpeggio
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
        } catch (e) {
            console.log(e);
        }
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
    // 2. Heart Trail Effect on Mouse & Touch
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
    // 3. Envelope Opening Logic
    // ==========================================
    if (envelopeWrapper) {
        envelopeWrapper.addEventListener('click', () => {
            envelopeWrapper.classList.add('open');
            
            if (!isPlaying) {
                startRomanticMusic();
            }

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
    // 4. Live Countdown to October 19
    // ==========================================
    const daysEl = document.getElementById('cd-days');
    const hoursEl = document.getElementById('cd-hours');
    const minutesEl = document.getElementById('cd-minutes');
    const secondsEl = document.getElementById('cd-seconds');

    function updateCountdown() {
        const now = new Date();
        const currentYear = now.getFullYear();
        let targetDate = new Date(currentYear, 9, 19, 0, 0, 0); // Month 9 is October

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
    // 5. Card Navigation Flow
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

    // Step 1 -> Step 2 (Countdown -> Cake)
    const startCelebrationBtn = document.getElementById('start-celebration-btn');
    if (startCelebrationBtn) {
        startCelebrationBtn.addEventListener('click', () => {
            switchCards('countdown-card', 'cake-card');
        });
    }

    // ==========================================
    // 6. Interactive Cake & Candle Blowing
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
                candleStatus.innerHTML = `🎉 <strong>All candles blown! Your wish is sent to the stars! ✨</strong>`;
                candleStatus.classList.remove('text-warning');
                candleStatus.style.background = 'rgba(40, 167, 69, 0.2)';
                candleStatus.style.borderColor = 'rgba(40, 167, 69, 0.5)';
                candleStatus.style.color = '#75fbb3';

                triggerGrandConfetti();
                showToast("Wish Made! Now let me show you what's in my heart 💖");

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

    // Step 3 -> Step 4 (Map -> Memories)
    const toMemoriesBtn = document.getElementById('to-memories-btn');
    if (toMemoriesBtn) {
        toMemoriesBtn.addEventListener('click', () => {
            switchCards('map-card', 'memories-card');
        });
    }

    // ==========================================
    // 7. Things I Love About You (Polaroid Carousel)
    // ==========================================
    const memories = [
        {
            icon: 'fa-face-smile-beam',
            color: '#ff65a6',
            caption: '"The effortless way your smile instantly lights up my whole world."'
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
            caption: '"The kindness and warmth in your soul that made me fall completely for you."'
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

    // Step 4 -> Step 5 (Memories -> Letters)
    const toLettersBtn = document.getElementById('to-letters-btn');
    if (toLettersBtn) {
        toLettersBtn.addEventListener('click', () => {
            switchCards('memories-card', 'letters-card');
        });
    }

    // ==========================================
    // 8. "Open When..." Letters (Heartfelt Confession)
    // ==========================================
    const lettersData = {
        birthday: {
            tag: "Oct 19 Birthday Special 🎂",
            title: "Happy Birthday, Beautiful ❤️",
            body: "Today is the day the world was blessed with you, and I thank the universe every day that our paths crossed. Even though I have to be here in Chandigarh working while you celebrate in Diphu, Assam, you are the most special person in my life. May this birthday bring you infinite joy, laughter, and all the dreams you hold dear."
        },
        confession: {
            tag: "From the Deepest Corner of My Heart 💖",
            title: "The Truth I've Been Keeping Inside",
            body: "I don't know the exact second it happened, but somewhere between our random jokes, our late-night talks, and the way you listen to me, I fell completely in love with you. You're not just someone I like talking to — you're the person I want to share my life with."
        },
        distance: {
            tag: "Chandigarh to Diphu ✈️",
            title: "Why 2,248 Kilometers Means Nothing",
            body: "Being in Chandigarh while you are in Diphu taught me that physical distance is just geography. When two people are connected by heart, miles can never weaken the bond. If anything, the distance has only proven to me how much I want you in my life."
        },
        promise: {
            tag: "My Solemn Promise ✨",
            title: "What I Promise You",
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
        });
    });

    if (closeLetterBtn) {
        closeLetterBtn.addEventListener('click', () => {
            letterModal.classList.add('d-none');
        });
    }

    // Step 5 -> Step 6 (Letters -> Vouchers)
    const toVouchersBtn = document.getElementById('to-vouchers-btn');
    if (toVouchersBtn) {
        toVouchersBtn.addEventListener('click', () => {
            switchCards('letters-card', 'vouchers-card');
        });
    }

    // ==========================================
    // 9. Girlfriend Privileges & Vouchers
    // ==========================================
    const claimBtns = document.querySelectorAll('.claim-btn');
    const claimedVouchers = [];

    claimBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const voucherName = btn.dataset.voucher;
            const voucherCard = btn.closest('.voucher-card');

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-check me-1"></i> Claimed!';
            btn.classList.remove('btn-outline-pink');
            btn.classList.add('btn-success');

            if (voucherCard) {
                voucherCard.classList.add('claimed');
            }

            if (!claimedVouchers.includes(voucherName)) {
                claimedVouchers.push(voucherName);
            }

            triggerMiniConfetti();
            showToast(`Privilege unlocked: "${voucherName}"! ❤️`);
        });
    });

    // Step 6 -> Step 7 (Vouchers -> The Proposal Question)
    const toQuestionBtn = document.getElementById('to-question-btn');
    if (toQuestionBtn) {
        toQuestionBtn.addEventListener('click', () => {
            switchCards('vouchers-card', 'question-card');
        });
    }

    // ==========================================
    // 10. Playful Runaway "No" Button (Proposal Edition)
    // ==========================================
    const noBtn = document.getElementById('no-btn');
    const yesBtn = document.getElementById('yes-btn');
    const questionCard = document.getElementById('question-card');
    const finalCard = document.getElementById('final-card');

    const funnyMessages = [
        "Nice try, but 'No' is not an option! 😉",
        "Error 404: 'No' does not exist between Chandigarh & Diphu!",
        "Diphu server strictly rejected this button!",
        "You can't say No to love on your birthday! 😜",
        "Even the button knows you want to say YES!",
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
    // 11. "YES, I WILL!" Official Proposal Accept
    // ==========================================
    if (yesBtn) {
        yesBtn.addEventListener('click', () => {
            questionCard.classList.add('d-none');
            finalCard.classList.remove('d-none');
            finalCard.classList.add('animate__animated', 'animate__zoomIn');

            triggerGrandConfetti();
            showToast("SHE SAID YES! I'm the happiest person alive! ❤️💍");

            // Setup WhatsApp link with proposal acceptance
            const whatsappBtn = document.getElementById('whatsapp-reply-btn');
            if (whatsappBtn) {
                let vouchersText = "";
                if (claimedVouchers.length > 0) {
                    vouchersText = `\nI also claimed these privileges:\n- ${claimedVouchers.join('\n- ')}`;
                }

                const waMessage = encodeURIComponent(
                    `YES! A thousand times YES! ❤️💍 I'm officially your girlfriend!\n\nEven with 2,248 km between Chandigarh and Diphu, Assam, my heart is completely yours! Thank you for the most magical and unforgettable birthday surprise ever! 🥰🎂✨${vouchersText}\n\nCan't wait to see you soon! 💕`
                );
                whatsappBtn.href = `https://api.whatsapp.com/send?text=${waMessage}`;
            }
        });
    }

    // ==========================================
    // 12. Email Reply Integration
    // ==========================================
    const emailReplyBtn = document.getElementById('email-reply-btn');
    if (emailReplyBtn) {
        emailReplyBtn.addEventListener('click', async () => {
            const recipientEmail = "omitterang@gmail.com";
            const originalContent = emailReplyBtn.innerHTML;

            emailReplyBtn.disabled = true;
            emailReplyBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Sending Acceptance...';

            let claimedList = claimedVouchers.length > 0 ? claimedVouchers.join(', ') : 'None yet';

            try {
                const response = await fetch(`https://formspree.io/f/xjkkvqlg`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        email: "girlfriend@diphu.assam",
                        message: `SHE SAID YES TO BE YOUR GIRLFRIEND! ❤️💍\nFrom: Diphu, Assam to Chandigarh\nClaimed Privileges: ${claimedList}`,
                        _subject: `SHE SAID YES! (Will you be my girlfriend? Accepted from Diphu! ❤️)`
                    })
                });

                if (response.ok) {
                    showToast("Proposal acceptance sent to Chandigarh! ❤️");
                    emailReplyBtn.innerHTML = '<i class="fas fa-check me-2"></i> Sealed with Love!';
                    emailReplyBtn.classList.remove('btn-outline-light');
                    emailReplyBtn.classList.add('btn-success');
                } else {
                    throw new Error('Formspree fallback');
                }
            } catch (err) {
                showToast("Opening email app to confirm... ✉️");
                const subject = encodeURIComponent("YES! I will be your girlfriend! ❤️💍");
                const body = encodeURIComponent(
                    `YES! A thousand times YES! ❤️💍 I'm officially your girlfriend!\n\nThank you for the most incredible birthday surprise from Chandigarh to Diphu! 🎂✨\n\nClaimed Privileges: ${claimedList}\n\nI can't wait until we meet! 💕`
                );
                window.location.href = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;

                emailReplyBtn.disabled = false;
                emailReplyBtn.innerHTML = originalContent;
            }
        });
    }

    // ==========================================
    // 13. Confetti Systems
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
    // 14. Toast Notification
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
    // 15. Sparkles Background System
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

        const colors = ['#ff2a85', '#c37aff', '#ffffff', '#ffd166', '#00d2ff'];
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
