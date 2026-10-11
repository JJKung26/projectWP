function openSheet(id) {
    if (id === 'sheet') renderSheet();
    dialogOpen(id, 'open');
    document.getElementById('sheetOverlay').classList.add('open');
}

function closeSheets() {
    document.querySelectorAll('.sheet.open').forEach(s => dialogClose(s.id, 'open'));
    document.getElementById('sheetOverlay').classList.remove('open');
}

function openCatSheet() {
    const current = document.querySelector('.category-tab.active')?.dataset.cat;
    document.querySelectorAll('.cat-list a').forEach(a => {
        const on = a.dataset.cat === current;
        a.classList.toggle('current', on);
        a.querySelector('.tick').style.visibility = on ? 'visible' : 'hidden';
    });
    openSheet('catSheet');
}

// Search
function openSearch() {
    document.body.classList.add('searching');
    window.scrollTo(0, 0);
    document.getElementById('searchInput').focus();
}

function closeSearch() {
    document.getElementById('searchInput').value = '';
    filterMenu('');
    document.body.classList.remove('searching');
}

function filterMenu(q) {
    q = q.trim().toLowerCase();
    let any = false;
    document.querySelectorAll('.menu-section').forEach(sec => {
        let shown = 0;
        sec.querySelectorAll('.menu-row').forEach(row => {
            const hit = !q || row.dataset.name.toLowerCase().includes(q);
            row.style.display = hit ? '' : 'none';
            if (hit) shown++;
        });
        sec.style.display = shown ? '' : 'none';
        if (shown) any = true;
    });
    document.getElementById('noResult').style.display = any ? 'none' : 'block';
}

let toastTimer;
function toast(msg, isError) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
