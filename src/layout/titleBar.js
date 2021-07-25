const { ipcRenderer } = require('electron');
const ipc = ipcRenderer;

const maxBtn = document.getElementById('maxBtn');
const folderView = document.getElementById('folderView');
const resize = document.getElementById('resize');
let folderViewChilds = Array.from(folderView.childNodes);

var isfolderViewActive = true;

// titleBar listener
minBtn.addEventListener('click', () => {
    ipc.send('minApp');
})

maxBtn.addEventListener('click', () => {
    ipc.send('maxResApp');
})

closeBtn.addEventListener('click', () => {
    ipc.send('closeApp');
})

function changeMaxResBtn(isMaxApp) {
    if (isMaxApp) {
        maxBtn.classList.remove('maxBtn');
        maxBtn.classList.add('restoreBtn');
    } else {
        maxBtn.classList.remove('restoreBtn');
        maxBtn.classList.add('maxBtn');
    }
}

ipc.on('isMaximized', () => { 
    changeMaxResBtn(true);
})
ipc.on('isRestored', () => { changeMaxResBtn(false) })

// menuBtn listener
menuBtn.addEventListener('click', () => {
    if (isfolderViewActive) {
        closeMenu();
    } else {
        openMenu();
    }
})

function closeMenu() {
    folderView.style.width = '0px';
    folderView.innerHTML = '';
    isfolderViewActive = false;
    resize.style.width = '0px';
}

function openMenu() {
    folderView.style.width = '300px';
    for (let i in folderViewChilds) {
        folderView.appendChild(folderViewChilds[i]);
    }
    resize.style.width = '6px';
    isfolderViewActive = true;
}