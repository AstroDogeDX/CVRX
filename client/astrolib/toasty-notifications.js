const overlay = document.querySelector('.toast-notification');

function pushToast(text, type) {
    let newToast = document.createElement('div');
    let toastType = type ? type : 'none';
    let toastText = text ? text : 'error: no toast message!';
    newToast.textContent = toastText;
    newToast.classList.add('toast');
    switch (toastType) {
        case 'confirm':
            newToast.classList.add('toast-confirm');
            break;
        case 'error':
            newToast.classList.add('toast-error');
            break;
        case 'info':
            newToast.classList.add('toast-info');
            break;
        default:
        // Do nothing
    }
    overlay.append(newToast);
    setTimeout(removeToast, 3000, newToast);
}

function removeToast(newToast) {
    newToast.classList.add('toast-begone');
    setTimeout(() => {
        newToast.remove();
    }, 200);
}

export { pushToast };
