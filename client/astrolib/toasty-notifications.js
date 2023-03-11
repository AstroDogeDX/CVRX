let toastTimer;

const toastDown = () => {
    toastTimer = setTimeout(() => {
        document.querySelector('.toast-notification').classList.remove('toast-up');
    }, 3000);
};

function toastyNotification(message, type) {
    const toast = document.querySelector('.toast-notification');
    clearTimeout(toastTimer);
    switch (type) {
        case 'confirm':
            toast.setAttribute('class', 'toast-notification toast-confirm');
            break;
        case 'error':
            toast.setAttribute('class', 'toast-notification toast-error');
            break;
        default:
            toast.setAttribute('class', 'toast-notification toast-info');
    }
    toast.innerHTML = message;
    toast.classList.add('toast-up');
    toastDown();
}

export { toastyNotification };
