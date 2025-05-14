const overlay = document.querySelector('.toast-notification');

function pushToast(text, type = 'none', duration = 3000) {
    // Create toast container
    const newToast = document.createElement('div');
    const toastText = text || 'error: no toast message!';
    const toastClassMap = {
        'confirm': 'toast-confirm',
        'error': 'toast-error',
        'info': 'toast-info',
        'warning': 'toast-warning',
    };

    // Create toast content with icon and text
    const toastContent = document.createElement('div');
    toastContent.classList.add('toast-content');

    // Add icon based on type
    const iconMap = {
        'confirm': 'check_circle',
        'error': 'error',
        'info': 'info',
        'warning': 'warning',
    };

    if (iconMap[type]) {
        const iconElement = document.createElement('span');
        iconElement.classList.add('toast-icon', 'material-symbols-outlined');
        iconElement.textContent = iconMap[type];
        toastContent.appendChild(iconElement);
    }

    // Add message
    const messageElement = document.createElement('span');
    messageElement.classList.add('toast-message');
    messageElement.textContent = toastText;
    toastContent.appendChild(messageElement);

    // Add progress bar
    const progressBar = document.createElement('div');
    progressBar.classList.add('toast-progress');

    // Build toast
    newToast.classList.add('toast');
    if (toastClassMap[type]) {
        newToast.classList.add(toastClassMap[type]);
    }

    newToast.appendChild(toastContent);
    newToast.appendChild(progressBar);

    // Add to DOM
    overlay.append(newToast);

    // Animate progress bar
    progressBar.style.transition = `width ${duration}ms linear`;

    // Trigger layout reflow to ensure transition works
    progressBar.getBoundingClientRect();

    // Start progress animation
    progressBar.style.width = '0%';

    // Add click to dismiss
    newToast.addEventListener('click', () => {
        removeToast(newToast);
    });

    // Set auto-remove timeout
    setTimeout(removeToast, duration, newToast);
}

function removeToast(newToast) {
    if (newToast.classList.contains('toast-begone')) return;

    newToast.classList.add('toast-begone');
    setTimeout(() => {
        newToast.remove();
    }, 300);
}

export { pushToast };
