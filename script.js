document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    const envelopeWrapper = document.getElementById('envelope-wrapper');
    const envelopeScreen = document.getElementById('envelope-screen');

    // 0. Heart Trail Logic
    document.addEventListener('mousemove', (e) => {
        if (Math.random() > 0.1) return; // Limit frequency
        const heart = document.createElement('i');
        heart.className = 'fas fa-heart cursor-heart';
        heart.style.left = e.pageX + 'px';
        heart.style.top = e.pageY + 'px';
        document.body.appendChild(heart);
        setTimeout(() => heart.remove(), 1000);
    });

    // 1. Envelope Opening Logic
    if (envelopeWrapper) {
        envelopeWrapper.addEventListener('click', () => {
            envelopeWrapper.classList.add('open');
            setTimeout(() => {
                envelopeScreen.classList.add('animate__animated', 'animate__fadeOut');
                setTimeout(() => {
                    envelopeScreen.classList.add('d-none');
                    mainContent.classList.remove('d-none');
                    mainContent.classList.add('animate__animated', 'animate__fadeIn');
                }, 500);
            }, 1200);
        });
    }

    // 1.5 Type Selection Adaptation
    const typeBoxes = document.querySelectorAll('.type-box');
    const typeSelectionCard = document.getElementById('type-selection-card');
    const questionCard = document.getElementById('question-card');
    const mainIcon = document.getElementById('main-icon');
    const mainQuestionText = document.getElementById('main-question-text');

    const config = {
        date: {
            icon: 'fa-calendar-heart',
            color: 'text-pink',
            question: 'Will you go out with me?',
            successTitle: 'YAYYYYY! ❤️',
            successMsg: 'You just made my entire year. ✨',
            actionTitle: "Let's Plan!",
            actionSubtitle: 'Where should we go first?',
            sectionId: 'date-content'
        },
        marry: {
            icon: 'fa-ring',
            color: 'text-warning',
            question: 'Will you marry me?',
            successTitle: 'YES! ❤️💍',
            successMsg: 'To a lifetime of love and happiness together! ✨',
            actionTitle: "The Big Day!",
            actionSubtitle: 'What should we dream of first?',
            sectionId: 'marry-content'
        },
        friends: {
            icon: 'fa-user-friends',
            color: 'text-info',
            question: 'Will you be my friend?',
            successTitle: 'Awesome! 🤝',
            successMsg: 'Life is better with friends like you! ✨',
            actionTitle: "Hangout Time!",
            actionSubtitle: 'What should we do first?',
            sectionId: 'friends-content'
        },
        besties: {
            icon: 'fa-sparkles',
            color: 'text-purple',
            question: 'Will you be my best friend?',
            successTitle: 'BFFs Forever! ✨👯‍♀️',
            successMsg: 'Soulmates in friendship! So happy! ✨',
            actionTitle: "BFF Bucket List!",
            actionSubtitle: 'Our first adventure starts here...',
            sectionId: 'friends-content' // Sharing the same section for now
        }
    };

    let currentType = 'date';

    typeBoxes.forEach(box => {
        box.addEventListener('click', () => {
            currentType = box.dataset.type;
            const data = config[currentType];

            // Adapt the question card
            mainIcon.className = `fas ${data.icon} floating-heart ${data.color}`;
            mainQuestionText.innerText = data.question;
            mainQuestionText.className = `mb-5 playfair italic ${data.color}`;

            // Adapt the success card (prepare it)
            document.getElementById('success-title').innerText = data.successTitle;
            document.getElementById('success-msg').innerText = data.successMsg;
            document.getElementById('success-icon').className = `fas ${data.icon} fa-5x ${data.color} beat-animation`;

            // Transition
            typeSelectionCard.classList.add('animate__animated', 'animate__fadeOutLeft');
            setTimeout(() => {
                typeSelectionCard.classList.add('d-none');
                typeSelectionCard.classList.remove('animate__animated', 'animate__fadeOutLeft'); // Cleanup
                questionCard.classList.remove('d-none');
                questionCard.classList.add('animate__animated', 'animate__fadeInRight');
                
                setTimeout(() => {
                    questionCard.classList.remove('animate__animated', 'animate__fadeInRight');
                }, 500);
            }, 500);
        });
    });

    const noBtn = document.getElementById('no-btn');
    const yesBtn = document.getElementById('yes-btn');
    const successCard = document.getElementById('success-card');
    const sparkContainer = document.getElementById('spark-container');

    const funnyMessages = [
        "Nice try! 😉",
        "Error 404: 'No' not found",
        "Wrong button, try the big blue one!",
        "Even the button is running away!",
        "Are you sure? I think you meant Yes!",
        "You're persistent! I like that. But still No."
    ];

    let yesScale = 1;

    const moveNoButton = () => {
        const padding = 20;
        
        // Grow the Yes button
        yesScale += 0.1;
        yesBtn.style.transform = `scale(${yesScale})`;
        yesBtn.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

        // Show a funny message
        showToast(funnyMessages[Math.floor(Math.random() * funnyMessages.length)]);

        // Move the No button
        const maxX = window.innerWidth - noBtn.offsetWidth - padding;
        const maxY = window.innerHeight - noBtn.offsetHeight - padding;
        const randomX = Math.random() * maxX;
        const randomY = Math.random() * maxY;

        noBtn.style.position = 'fixed';
        noBtn.style.left = `${randomX}px`;
        noBtn.style.top = `${randomY}px`;
        noBtn.style.zIndex = '1000';
    };

    const showToast = (message) => {
        const toast = document.createElement('div');
        toast.className = 'custom-toast';
        toast.innerText = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 500);
            }, 2000);
        }, 100);
    };

    if (noBtn) {
        noBtn.addEventListener('mouseover', moveNoButton);
        noBtn.addEventListener('click', (e) => {
            e.preventDefault();
            moveNoButton();
        });
    }

    // 2. "Yes" Button Action
    if (yesBtn) {
        yesBtn.addEventListener('click', () => {
            questionCard.classList.add('d-none');
            successCard.classList.remove('d-none');
            triggerConfetti();

            // Prepare the action card for later
            const data = config[currentType];
            document.getElementById('action-title').innerText = data.actionTitle;
            document.getElementById('action-subtitle').innerText = data.actionSubtitle;
            
            // Show only relevant section
            document.querySelectorAll('.action-section').forEach(s => s.classList.add('d-none'));
            document.getElementById(data.sectionId).classList.remove('d-none');
        });
    }

    // 3. Planning Screen Transition
    const planDateBtn = document.getElementById('plan-date-btn');
    const planCard = document.getElementById('plan-card');

    if (planDateBtn) {
        planDateBtn.addEventListener('click', () => {
            successCard.classList.add('d-none');
            planCard.classList.remove('d-none');
        });
    }

    // 3.5 Back Buttons Logic
    const backToType = document.getElementById('back-to-type');
    const backToSuccess = document.getElementById('back-to-success');
    const backToQuestion = document.getElementById('back-to-question');

    if (backToType) {
        backToType.addEventListener('click', () => {
            // Clean up question card
            questionCard.classList.add('animate__animated', 'animate__fadeOutRight');
            
            setTimeout(() => {
                questionCard.classList.add('d-none');
                questionCard.classList.remove('animate__animated', 'animate__fadeOutRight');
                
                // Prepare and show type selection card
                typeSelectionCard.classList.remove('d-none', 'animate__fadeOutLeft'); // Remove previous fade out
                typeSelectionCard.classList.add('animate__animated', 'animate__fadeInLeft');
                
                // Cleanup fadeIn class after it's done
                setTimeout(() => {
                    typeSelectionCard.classList.remove('animate__animated', 'animate__fadeInLeft');
                }, 500);
            }, 500);
        });
    }

    if (backToSuccess) {
        backToSuccess.addEventListener('click', () => {
            planCard.classList.add('d-none');
            successCard.classList.remove('d-none');
        });
    }

    if (backToQuestion) {
        backToQuestion.addEventListener('click', () => {
            successCard.classList.add('d-none');
            questionCard.classList.remove('d-none');
        });
    }

    // 4. Selection Logic
    const dateOptions = document.querySelectorAll('.date-option');
    const dayButtons = document.querySelectorAll('.day-btn');
    let selectedType = '';
    let selectedDay = '';

    dateOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            dateOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            selectedType = opt.dataset.type;
        });
    });

    dayButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            dayButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDay = btn.innerText;
        });
    });

    const finalBtn = document.getElementById('final-confirm-btn');
    const finalCard = document.getElementById('final-card');
    const finalSummaryText = document.getElementById('final-summary-text');

    if (finalBtn) {
        finalBtn.addEventListener('click', () => {
            if(!selectedType || !selectedDay) {
                showToast("Please pick a place and a day! 😊");
                return;
            }
            
            // Set summary text
            finalSummaryText.innerText = `${selectedType} on ${selectedDay}`;

            // Transition to final card
            planCard.classList.add('animate__animated', 'animate__zoomOut');
            setTimeout(() => {
                planCard.classList.add('d-none');
                finalCard.classList.remove('d-none');
                finalCard.classList.add('animate__animated', 'animate__zoomIn');
                triggerConfetti();
                showToast("Locked in! ❤️");
            }, 500);
        });
    }

    // 5. Confetti Effect
    const triggerConfetti = () => {
        const duration = 15 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    };

    // 6. Spark Particle System
    const createSpark = () => {
        if (!sparkContainer) return;
        const spark = document.createElement('div');
        spark.className = 'spark';
        
        const size = Math.random() * 4 + 2;
        spark.style.width = `${size}px`;
        spark.style.height = `${size}px`;
        
        const startX = Math.random() * window.innerWidth;
        const startY = Math.random() * window.innerHeight;
        
        spark.style.left = `${startX}px`;
        spark.style.top = `${startY}px`;
        
        const colors = ['#ff0080', '#7928ca', '#ffffff', '#ff4d4d'];
        spark.style.background = colors[Math.floor(Math.random() * colors.length)];
        spark.style.boxShadow = `0 0 10px ${spark.style.background}`;
        
        sparkContainer.appendChild(spark);

        const duration = Math.random() * 3000 + 2000;
        const destinationX = startX + (Math.random() - 0.5) * 200;
        const destinationY = startY - Math.random() * 300;

        const animation = spark.animate([
            { opacity: 0, transform: 'translate(0, 0) scale(0)' },
            { opacity: 0.8, transform: `translate(${(destinationX - startX) / 2}px, ${(destinationY - startY) / 2}px) scale(1)`, offset: 0.5 },
            { opacity: 0, transform: `translate(${destinationX - startX}px, ${destinationY - startY}px) scale(0)` }
        ], {
            duration: duration,
            easing: 'ease-out'
        });

        animation.onfinish = () => spark.remove();
    };

    setInterval(createSpark, 200);
});
