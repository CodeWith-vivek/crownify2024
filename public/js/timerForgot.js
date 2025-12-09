    const timerElement = document.getElementById('timer');
    const verifyOtpButton = document.getElementById('verifyOtp');
    const otpInputs = document.querySelectorAll('.otp-input');
    const resendButton = document.getElementById('resendOtp');
    const currentEmail = document.getElementById('user-email').value;

    let countdownTime = parseInt(
      timerElement.getAttribute("data-countdown-time"),
      10
    ); 
    let intervalId;

  
    function loadCountdownTime() {
        const savedTime = localStorage.getItem('countdownTime');
        const isExpired = localStorage.getItem('timerExpired') === 'true';

        if (savedTime) {
            countdownTime = parseInt(savedTime, 10);
        }

        if (isExpired || countdownTime <= 0) {
            displayTimerExpired();
            return true;
        }
        return false;
    }


    function saveCountdownTime() {
        localStorage.setItem('countdownTime', countdownTime);

        localStorage.removeItem('timerExpired');
    }

 
    function clearCountdownTime() {
        localStorage.removeItem('countdownTime');
        localStorage.removeItem('timerExpired');
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function startCountdown() {

        if (loadCountdownTime()) {
            return; 
        }

        updateTimerDisplay();
        intervalId = setInterval(() => {
            if (countdownTime > 0) {
                countdownTime--;
                saveCountdownTime();
                updateTimerDisplay();
            }

            if (countdownTime === 0) {
                clearInterval(intervalId);
                displayTimerExpired();
      
                localStorage.setItem('timerExpired', 'true');
            }
        }, 1000);
    }


    function updateTimerDisplay() {
        timerElement.innerHTML = formatTime(countdownTime) + ' Sec';
        resendButton.style.pointerEvents = countdownTime > 0 ? 'none' : 'auto';
    }

    function displayTimerExpired() {
        timerElement.style.color = 'red';
        timerElement.innerHTML = 'Timer Expired';
        timerElement.style.fontSize = "20px";
        otpInputs.forEach(input => {
            input.value = '';
            input.disabled = true;
        });
        resendButton.style.pointerEvents = 'auto';
    }

    function resetOtpInputs() {
        otpInputs.forEach(input => {
            input.disabled = false;
            input.value = '';
        });
        otpInputs[0].focus();
    }

    function moveToNext(current, nextFieldID) {
        if (current.value.length === 1 && !isNaN(current.value)) {
            document.getElementById(nextFieldID).focus();
        } else {
            current.value = ''; 
        }
    }

    function moveToPrev(current, prevFieldID, event) {
        if (event.key === 'Backspace' && current.value.length === 0) {
            document.getElementById(prevFieldID).focus();
        }
    }

    const storedEmail = localStorage.getItem('currentEmail');
    if (storedEmail !== currentEmail) {
        localStorage.setItem('currentEmail', currentEmail);
        countdownTime = 120; 
        clearCountdownTime();
    }
    startCountdown();

    otpInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            if (!/^\d*$/.test(e.target.value)) {
                e.target.value = '';
            }
        });
    });

    verifyOtpButton.addEventListener('click', () => {
        let otpCode = '';
        otpInputs.forEach(input => otpCode += input.value);

        if (otpCode.length === 6) {
            fetch('/verify-otp-forgot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otp: otpCode })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'OTP Verified',
                            text: 'Your OTP has been verified successfully.',
                            confirmButtonText: 'Continue',
                            customClass: {
                                popup: 'animated bounceIn'
                            }
                        }).then(() => {
                            window.location.href = '/reset-password';
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Invalid OTP',
                            text: 'Please check the OTP and try again.',
                            customClass: {
                                popup: 'animated shake'
                            }
                        });
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'An error occurred while verifying the OTP. Please try again later.',
                    });
                });
        } else {
            Swal.fire('Please enter the full 6-digit OTP.');
        }
    });

 
    resendButton.onclick = () => {
        if (countdownTime > 0) return; 

        countdownTime = 120; 
        timerElement.style.color = 'gray';
        timerElement.style.fontSize = "14px";
        clearCountdownTime();
        saveCountdownTime();
        resetOtpInputs();
        startCountdown();

        fetch('/resend-otp-forgot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: sessionStorage.getItem('email') })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    Swal.fire({
                        icon: 'info',
                        title: 'OTP Resent',
                        text: 'A new OTP has been sent to your email.',
                        showConfirmButton: false,
                        timer: 1500
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message || 'Failed to resend OTP. Please try again.',
                    });
                }
            })
            .catch(error => {
                console.error('Error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'An error occurred while resending the OTP. Please try again later.',
                });
            });
    };