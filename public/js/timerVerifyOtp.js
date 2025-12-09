            const timerElement = document.getElementById('timer');
            const verifyOtpButton = document.getElementById('verifyOtp');
            const otpInputs = document.querySelectorAll('.otp-input');
            const resendButton = document.getElementById('resendOtp');
            const currentEmail = document.getElementById('user-email').value;


            countdownTime = parseInt(
              timerElement.getAttribute("data-countdown-time"),
              10
            ); 
            let intervalId;


            function loadCountdownTime() {
                const savedTime = localStorage.getItem('countdownTime');
                if (savedTime) {
                    countdownTime = parseInt(savedTime, 10);
                }
            }


            function saveCountdownTime() {
                localStorage.setItem('countdownTime', countdownTime);
            }


            function clearCountdownTime() {
                localStorage.removeItem('countdownTime');
            }

            function formatTime(seconds) {
                const minutes = Math.floor(seconds / 60);
                const secs = seconds % 60;
                return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }

            function updateTimerDisplay() {
                timerElement.innerHTML = formatTime(countdownTime) + ' Sec';
                resendButton.style.pointerEvents = countdownTime > 0 ? 'none' : 'auto';
            }

            function startCountdown() {
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

                    }
                }, 1000);
            }
            function displayTimerExpired() {
                timerElement.style.color = 'red';
                timerElement.innerHTML = 'Timer Expired';
                timerElement.style.fontSize = '20px';
                otpInputs.forEach(input => input.value = '');
                otpInputs.forEach(input => input.disabled = true);
            }

            function resetOtpInputs() {
                otpInputs.forEach(input => {
                    input.disabled = false;
                    input.value = '';
                });
                otpInputs[0].focus();
            }
            function disableOtpInputs() {
                otpInputs.forEach(input => {
                    input.disabled = true;
                });
            }
            function enableOtpInputs() {
                otpInputs.forEach(input => {
                    input.disabled = false;
                });
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
            otpInputs.forEach(input => {
                input.addEventListener('input', (e) => {
                    if (!/^\d*$/.test(e.target.value)) {
                        e.target.value = '';
                    }
                });
            });


            loadCountdownTime();
            if (countdownTime > 0) {
                startCountdown();
            } else {
                displayTimerExpired();
            }

            verifyOtpButton.addEventListener('click', () => {
                let otpCode = '';
                otpInputs.forEach(input => otpCode += input.value);

                if (otpCode.length === 6) {
                    fetch('/verify-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ otp: otpCode })
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {

                                clearCountdownTime();
                                sessionStorage.setItem('signupComplete', 'true');

                                Swal.fire({
                                    icon: 'success',
                                    title: 'OTP Verified',
                                    text: 'Your OTP has been verified successfully logging in.',
                                    confirmButtonText: 'Continue',
                                    customClass: {
                                        popup: 'animated bounceIn'
                                    }
                                }).then(() => {
                                    window.location.replace(data.redirectUrl || '/');
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
            document.addEventListener('DOMContentLoaded', function () {
                if (sessionStorage.getItem('signupComplete') === 'true') {
                    window.location.replace('/');
                }
            });


            window.addEventListener('beforeunload', function () {
                if (window.location.pathname === '/logout') {
                    sessionStorage.removeItem('signupComplete');
                }
            });



            resendButton.onclick = () => {
                if (countdownTime > 0) return;
                countdownTime = 120;
                timerElement.style.color = 'gray';
                timerElement.style.fontSize = "14px";
                saveCountdownTime();
                resetOtpInputs();
                startCountdown();

                fetch('/resend-otp', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
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