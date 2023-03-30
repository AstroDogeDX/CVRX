const overlay = document.querySelector('.toast-notification');

function pushToast(text, type = 'none') {
    const newToast = document.createElement('div');
    const toastText = text || 'error: no toast message!';
    const toastClassMap = {
        'confirm': 'toast-confirm',
        'error': 'toast-error',
        'info': 'toast-info'
    };

    newToast.textContent = toastText;
    newToast.classList.add('toast');
    if (toastClassMap[type]) {
        newToast.classList.add(toastClassMap[type]);
    }
    overlay.append(newToast);
    setTimeout(removeToast, 2500, newToast);
}

function removeToast(newToast) {
    newToast.classList.add('toast-begone');
    setTimeout(() => {
        newToast.remove();
    }, 200);
}

export { pushToast };

