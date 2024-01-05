    const btn = document.querySelector('#submit');
    const username = document.querySelector('#username');
    const password = document.querySelector('#password');

    const submitHandler = () => {
        if (username?.value && password?.value) {
            const token = username.value;
            localStorage.setItem('recorder_token', token);
            btn.removeEventListener('click', submitHandler);
            navigator.serviceWorker.controller.postMessage({
                action: 'set-token',
                token: token,
            });
        } else {
            alert('Invalid credentials. Please try again.');
        }
    }

    btn.addEventListener('click', submitHandler);
