// ─── Config Page — Figma-style Inline Editing ────────────────

/* ── State ──────────────────────────────────────────────────── */
const S = {
    displayId: null,
    layout: null,
    background: null,
    description: '',
    selectedZone: null,   // null = global, number = zone index
    activeTab: 'content', // content | style | schedule
    dirty: false,
    zonePositionMap: [],  // [{r,c,rowSpan,colSpan}, ...]
};

/* ── Font Options (shared between global & zone selects) ───── */
const FONT_OPTIONS = `
<optgroup label="Modern Sans-Serif">
    <option value="Inter, sans-serif">Inter</option>
    <option value="'Work Sans', sans-serif">Work Sans</option>
    <option value="Manrope, sans-serif">Manrope</option>
    <option value="'Space Grotesk', sans-serif">Space Grotesk</option>
    <option value="'IBM Plex Sans', sans-serif">IBM Plex Sans</option>
    <option value="Rubik, sans-serif">Rubik</option>
    <option value="'DM Sans', sans-serif">DM Sans</option>
    <option value="'Plus Jakarta Sans', sans-serif">Plus Jakarta Sans</option>
    <option value="Outfit, sans-serif">Outfit</option>
    <option value="Lexend, sans-serif">Lexend</option>
    <option value="Sora, sans-serif">Sora</option>
</optgroup>
<optgroup label="Popular Sans-Serif">
    <option value="Roboto, sans-serif">Roboto</option>
    <option value="'Open Sans', sans-serif">Open Sans</option>
    <option value="Lato, sans-serif">Lato</option>
    <option value="Montserrat, sans-serif">Montserrat</option>
    <option value="Poppins, sans-serif">Poppins</option>
    <option value="'Source Sans Pro', sans-serif">Source Sans Pro</option>
    <option value="Ubuntu, sans-serif">Ubuntu</option>
    <option value="Nunito, sans-serif">Nunito</option>
    <option value="Raleway, sans-serif">Raleway</option>
    <option value="'PT Sans', sans-serif">PT Sans</option>
    <option value="Oswald, sans-serif">Oswald</option>
    <option value="'Fira Sans', sans-serif">Fira Sans</option>
    <option value="Barlow, sans-serif">Barlow</option>
    <option value="Quicksand, sans-serif">Quicksand</option>
    <option value="Karla, sans-serif">Karla</option>
    <option value="Mulish, sans-serif">Mulish</option>
    <option value="'Red Hat Display', sans-serif">Red Hat Display</option>
</optgroup>
<optgroup label="Serif Fonts">
    <option value="'Playfair Display', serif">Playfair Display</option>
    <option value="Merriweather, serif">Merriweather</option>
    <option value="'Roboto Slab', serif">Roboto Slab</option>
</optgroup>
<optgroup label="System Fonts">
    <option value="Arial, sans-serif">Arial</option>
    <option value="'Times New Roman', serif">Times New Roman</option>
    <option value="'Courier New', monospace">Courier New</option>
    <option value="Georgia, serif">Georgia</option>
    <option value="Verdana, sans-serif">Verdana</option>
    <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
    <option value="'Lucida Console', monospace">Lucida Console</option>
    <option value="Impact, sans-serif">Impact</option>
    <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
</optgroup>
<optgroup label="Emoji Fonts">
    <option value="sans-serif, 'Noto Color Emoji'">Noto Color Emoji (color)</option>
    <option value="sans-serif, 'Noto Emoji'">Noto Emoji (monochrome)</option>
    <option value="sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'">System Emoji</option>
</optgroup>`;

/* ── Zone Type Definitions ──────────────────────────────────── */
const ZONE_TYPES = [
    { value: 'empty',        icon: 'check_box_outline_blank', label: 'Empty' },
    { value: 'clock',        icon: 'schedule',                label: 'Clock' },
    { value: 'timer',        icon: 'timer',                   label: 'Timer' },
    { value: 'announcement', icon: 'campaign',                label: 'Announce' },
    { value: 'weather',      icon: 'cloud',                   label: 'Weather' },
    { value: 'rss',          icon: 'rss_feed',                label: 'RSS' },
    { value: 'image',        icon: 'image',                   label: 'Image' },
    { value: 'video',        icon: 'videocam',                label: 'Video' },
    { value: 'slideshow',    icon: 'slideshow',               label: 'Slideshow' },
    { value: 'iframe',       icon: 'web',                     label: 'iFrame' },
];

/* ── Init ───────────────────────────────────────────────────── */
function initConfigPage(id, layout, bg, description) {
    S.displayId = id;
    S.layout = layout;
    S.background = bg;
    S.description = description || '';

    // Ensure defaults
    S.layout.top_bar = S.layout.top_bar || { mode: 'visible', show_seconds: true, font_weight: '700' };
    S.layout.orientation = S.layout.orientation || 'landscape';
    S.layout.resolution_w = S.layout.resolution_w || 1920;
    S.layout.resolution_h = S.layout.resolution_h || 1080;
    S.layout.global_font = S.layout.global_font || 'Arial, sans-serif';

    // Click outside grid to deselect
    document.querySelector('.grid-canvas').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) deselectZone();
    });

    // Unsaved changes warning — native dialog only as a fallback for
    // tab-close/refresh, where the browser dialog is unavoidable.
    window.addEventListener('beforeunload', (e) => {
        if (S.dirty && !S._bypassUnloadGuard) { e.preventDefault(); e.returnValue = ''; }
    });

    // Intercept in-app link clicks to show a styled modal instead of the native dialog.
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link || link.target === '_blank') return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
        if (!S.dirty) return;
        e.preventDefault();
        showLeaveConfirmModal(href);
    });

    renderGrid();
    renderPanel();
}

/* ── Unsaved Changes Modal ──────────────────────────────────── */
function showLeaveConfirmModal(href) {
    const modal = document.createElement('div');
    modal.className = 'modal leave-confirm-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:440px;">
            <h3 style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
                <i class="material-icons" style="color:var(--warning-color);">warning_amber</i>
                Unsaved changes
            </h3>
            <p style="color:var(--text-secondary);margin:0;">
                You have unsaved changes that will be lost if you leave this page.
            </p>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" data-action="cancel">Stay</button>
                <button type="button" class="btn btn-danger" data-action="leave">Discard &amp; Leave</button>
                <button type="button" class="btn btn-primary" data-action="save">
                    <i class="material-icons">save</i>
                    Save &amp; Leave
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const navigate = () => {
        S._bypassUnloadGuard = true;
        window.location.href = href;
    };
    const close = () => modal.remove();

    modal.querySelector('[data-action="cancel"]').addEventListener('click', close);
    modal.querySelector('[data-action="leave"]').addEventListener('click', () => { close(); navigate(); });
    modal.querySelector('[data-action="save"]').addEventListener('click', async () => {
        close();
        await saveConfig();
        if (!S.dirty) navigate();
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    const onKey = (e) => {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);
}

/* ── Dirty Flag ─────────────────────────────────────────────── */
function markDirty() {
    S.dirty = true;
    const btn = document.getElementById('saveBtn');
    btn.classList.add('save-pulse');
}

/* ── Toast ──────────────────────────────────────────────────── */
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="material-icons">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}</i> ${message}`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ── Grid Rendering ─────────────────────────────────────────── */
function onGridChange() {
    reconcileZones();
    renderGrid();
    renderPanel();
    markDirty();
    updateLivePreview();
}

function addRow() {
    if (S.layout.grid.rows >= 6) return;
    S.layout.grid.rows++;
    onGridChange();
}

function removeRow() {
    if (S.layout.grid.rows <= 1) return;
    S.layout.grid.rows--;
    onGridChange();
}

function addCol() {
    if (S.layout.grid.cols >= 6) return;
    S.layout.grid.cols++;
    onGridChange();
}

function removeCol() {
    if (S.layout.grid.cols <= 1) return;
    S.layout.grid.cols--;
    onGridChange();
}

function removeSpecificRow(rowIndex) {
    const { rows, cols } = S.layout.grid;
    if (rows <= 1) return;

    // Remove zones that occupy only this row, shrink zones that span across it
    for (let i = S.layout.zones.length - 1; i >= 0; i--) {
        const pos = S.zonePositionMap[i];
        if (!pos) continue;
        const zoneEnd = pos.r + pos.rowSpan - 1;
        if (rowIndex >= pos.r && rowIndex <= zoneEnd) {
            if (pos.rowSpan > 1) {
                S.layout.zones[i].row_span = pos.rowSpan - 1;
            } else {
                S.layout.zones.splice(i, 1);
            }
        }
    }
    S.layout.grid.rows--;
    S.selectedZone = null;
    onGridChange();
}

function removeSpecificCol(colIndex) {
    const { rows, cols } = S.layout.grid;
    if (cols <= 1) return;

    // Remove zones that occupy only this column, shrink zones that span across it
    for (let i = S.layout.zones.length - 1; i >= 0; i--) {
        const pos = S.zonePositionMap[i];
        if (!pos) continue;
        const zoneEnd = pos.c + pos.colSpan - 1;
        if (colIndex >= pos.c && colIndex <= zoneEnd) {
            if (pos.colSpan > 1) {
                S.layout.zones[i].col_span = pos.colSpan - 1;
            } else {
                S.layout.zones.splice(i, 1);
            }
        }
    }
    S.layout.grid.cols--;
    S.selectedZone = null;
    onGridChange();
}

function reconcileZones() {
    const { rows, cols } = S.layout.grid;
    const occupied = Array.from({ length: rows }, () => Array(cols).fill(false));
    let placedCount = 0;

    for (let i = 0; i < S.layout.zones.length; i++) {
        const zone = S.layout.zones[i];
        const colSpan = Math.min(zone.col_span || 1, cols);
        const rowSpan = Math.min(zone.row_span || 1, rows);
        let placed = false;
        for (let r = 0; r < rows && !placed; r++) {
            for (let c = 0; c < cols && !placed; c++) {
                if (occupied[r][c]) continue;
                if (r + rowSpan > rows || c + colSpan > cols) continue;
                let fits = true;
                for (let dr = 0; dr < rowSpan && fits; dr++)
                    for (let dc = 0; dc < colSpan && fits; dc++)
                        if (occupied[r + dr][c + dc]) fits = false;
                if (fits) {
                    for (let dr = 0; dr < rowSpan; dr++)
                        for (let dc = 0; dc < colSpan; dc++)
                            occupied[r + dr][c + dc] = true;
                    placed = true;
                    placedCount++;
                }
            }
        }
        if (!placed) break;
    }

    let emptyCells = 0;
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (!occupied[r][c]) emptyCells++;

    const needed = placedCount + emptyCells;
    while (S.layout.zones.length < needed) {
        S.layout.zones.push(makeEmptyZone(S.layout.zones.length));
    }
    if (S.layout.zones.length > needed) {
        S.layout.zones = S.layout.zones.slice(0, needed);
    }

    // If selected zone no longer exists, deselect
    if (S.selectedZone !== null && S.selectedZone >= S.layout.zones.length) {
        S.selectedZone = null;
    }
}

function makeEmptyZone(id) {
    return {
        id, type: 'empty', content: '', opacity: 1.0,
        font_family: '', font_size: '16px', font_color: '',
        background: { type: 'transparent' },
        date_format: 'full', time_format: '24h'
    };
}

function renderGrid() {
    const { rows, cols } = S.layout.grid;
    const grid = document.getElementById('gridPreview');
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    // Apply aspect ratio from resolution
    const resW = S.layout.resolution_w || 1920;
    const resH = S.layout.resolution_h || 1080;
    grid.style.aspectRatio = `${resW} / ${resH}`;
    grid.style.flex = 'none';
    grid.style.alignSelf = 'center';
    grid.style.margin = '0 auto';
    grid.style.maxHeight = 'calc(100vh - 160px)';
    grid.style.width = resH > resW ? 'auto' : '100%';
    grid.style.height = resH > resW ? 'calc(100vh - 160px)' : 'auto';

    grid.innerHTML = '';
    S.zonePositionMap = [];

    // Add row/col buttons rendered inside the grid (positioned on edges)
    if (rows < 6) {
        const addRowBtn = document.createElement('button');
        addRowBtn.className = 'grid-edge-btn grid-edge-add grid-edge-row';
        addRowBtn.title = 'Add row';
        addRowBtn.innerHTML = '<i class="material-icons">add</i>';
        addRowBtn.addEventListener('click', (e) => { e.stopPropagation(); addRow(); });
        grid.appendChild(addRowBtn);
    }
    if (cols < 6) {
        const addColBtn = document.createElement('button');
        addColBtn.className = 'grid-edge-btn grid-edge-add grid-edge-col';
        addColBtn.title = 'Add column';
        addColBtn.innerHTML = '<i class="material-icons">add</i>';
        addColBtn.addEventListener('click', (e) => { e.stopPropagation(); addCol(); });
        grid.appendChild(addColBtn);
    }

    // Per-column remove buttons (top edge, absolute)
    if (cols > 1) {
        for (let c = 0; c < cols; c++) {
            const btn = document.createElement('button');
            btn.className = 'grid-edge-btn grid-edge-remove grid-edge-remove-col';
            btn.title = `Remove column ${c + 1}`;
            btn.innerHTML = '<i class="material-icons">close</i>';
            // Position: centered over each column on top edge
            btn.style.left = `calc(${(c + 0.5) / cols * 100}%)`;
            btn.addEventListener('click', (e) => { e.stopPropagation(); removeSpecificCol(c); });
            grid.appendChild(btn);
        }
    }

    // Per-row remove buttons (left edge, absolute)
    if (rows > 1) {
        for (let r = 0; r < rows; r++) {
            const btn = document.createElement('button');
            btn.className = 'grid-edge-btn grid-edge-remove grid-edge-remove-row';
            btn.title = `Remove row ${r + 1}`;
            btn.innerHTML = '<i class="material-icons">close</i>';
            // Position: centered over each row on left edge
            btn.style.top = `calc(${(r + 0.5) / rows * 100}%)`;
            btn.addEventListener('click', (e) => { e.stopPropagation(); removeSpecificRow(r); });
            grid.appendChild(btn);
        }
    }

    const occupied = Array.from({ length: rows }, () => Array(cols).fill(false));

    S.layout.zones.forEach((zone, i) => {
        const colSpan = Math.min(zone.col_span || 1, cols);
        const rowSpan = Math.min(zone.row_span || 1, rows);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (occupied[r][c]) continue;
                if (r + rowSpan > rows || c + colSpan > cols) continue;
                let fits = true;
                for (let dr = 0; dr < rowSpan && fits; dr++)
                    for (let dc = 0; dc < colSpan && fits; dc++)
                        if (occupied[r + dr][c + dc]) fits = false;
                if (!fits) continue;

                for (let dr = 0; dr < rowSpan; dr++)
                    for (let dc = 0; dc < colSpan; dc++)
                        occupied[r + dr][c + dc] = true;

                S.zonePositionMap[i] = { r, c, rowSpan, colSpan };

                const el = document.createElement('div');
                const isMerged = colSpan > 1 || rowSpan > 1;
                const isSelected = S.selectedZone === i;

                let cls = 'grid-zone';
                if (zone.type !== 'empty') cls += ' configured';
                if (isSelected) cls += ' selected';
                el.className = cls;

                el.style.gridColumn = `${c + 1} / span ${colSpan}`;
                el.style.gridRow = `${r + 1} / span ${rowSpan}`;

                const spanLabel = isMerged ? ` <span class="zone-span-badge">${colSpan}&times;${rowSpan}</span>` : '';
                const typeBadge = zone.type !== 'empty' ? `<span class="zone-type-badge">${zone.type}</span>` : '';

                const canN = r > 0 || rowSpan > 1;
                const canS = r + rowSpan < rows || rowSpan > 1;
                const canE = c + colSpan < cols || colSpan > 1;
                const canW = c > 0 || colSpan > 1;
                const handles = [
                    canN && `<div class="zone-resize-handle zone-resize-handle-n" data-mode="n" title="Drag to resize"></div>`,
                    canS && `<div class="zone-resize-handle zone-resize-handle-s" data-mode="s" title="Drag to resize"></div>`,
                    canE && `<div class="zone-resize-handle zone-resize-handle-e" data-mode="e" title="Drag to resize"></div>`,
                    canW && `<div class="zone-resize-handle zone-resize-handle-w" data-mode="w" title="Drag to resize"></div>`,
                    canN && canE && `<div class="zone-resize-handle zone-resize-handle-corner zone-resize-handle-ne" data-mode="ne" title="Drag to resize"></div>`,
                    canN && canW && `<div class="zone-resize-handle zone-resize-handle-corner zone-resize-handle-nw" data-mode="nw" title="Drag to resize"></div>`,
                    canS && canE && `<div class="zone-resize-handle zone-resize-handle-corner zone-resize-handle-se" data-mode="se" title="Drag to resize"></div>`,
                    canS && canW && `<div class="zone-resize-handle zone-resize-handle-corner zone-resize-handle-sw" data-mode="sw" title="Drag to resize"></div>`,
                ].filter(Boolean).join('');

                el.innerHTML = `
                    ${typeBadge}
                    <div class="zone-label">Zone ${i + 1}${spanLabel}</div>
                    ${handles}
                `;

                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectZone(i);
                });

                el.querySelectorAll('.zone-resize-handle').forEach(h => {
                    h.addEventListener('mousedown', (ev) => startResizeDrag(ev, i, h.dataset.mode));
                });

                grid.appendChild(el);
                return; // placed, next zone
            }
        }
    });

}

/* ── Drag-to-Resize ─────────────────────────────────────────── */
let _dragState = null;

function startResizeDrag(e, zoneIdx, mode) {
    e.preventDefault();
    e.stopPropagation();
    const grid = document.getElementById('gridPreview');
    const gridRect = grid.getBoundingClientRect();
    const { rows, cols } = S.layout.grid;
    const cs = getComputedStyle(grid);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const padT = parseFloat(cs.paddingTop) || 0;
    const padB = parseFloat(cs.paddingBottom) || 0;
    const colGap = parseFloat(cs.columnGap || cs.gap) || 0;
    const rowGap = parseFloat(cs.rowGap || cs.gap) || 0;
    const cellW = (gridRect.width - padL - padR - (cols - 1) * colGap) / cols;
    const cellH = (gridRect.height - padT - padB - (rows - 1) * rowGap) / rows;
    const pos = S.zonePositionMap[zoneIdx];
    if (!pos) return;

    _dragState = {
        zoneIdx, mode, gridRect, cellW, cellH, colGap, rowGap, padL, padT, rows, cols,
        startRect: { r: pos.r, c: pos.c, rowSpan: pos.rowSpan, colSpan: pos.colSpan },
        currentRect: { r: pos.r, c: pos.c, rowSpan: pos.rowSpan, colSpan: pos.colSpan },
    };

    document.body.classList.add('resizing-zone');
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);

    showResizeGhost(_dragState.currentRect);
}

function onResizeMove(e) {
    if (!_dragState) return;
    const { gridRect, cellW, cellH, colGap, rowGap, padL, padT, rows, cols, mode, startRect } = _dragState;

    const mx = e.clientX - gridRect.left - padL;
    const my = e.clientY - gridRect.top - padT;
    let mc = Math.max(0, Math.min(cols - 1, Math.floor(mx / (cellW + colGap))));
    let mr = Math.max(0, Math.min(rows - 1, Math.floor(my / (cellH + rowGap))));

    let { r, c, rowSpan, colSpan } = startRect;
    const startRight = startRect.c + startRect.colSpan - 1;
    const startBottom = startRect.r + startRect.rowSpan - 1;

    if (mode.includes('e')) {
        const newRight = Math.max(startRect.c, mc);
        colSpan = newRight - startRect.c + 1;
    }
    if (mode.includes('w')) {
        const newLeft = Math.min(startRight, mc);
        c = newLeft;
        colSpan = startRight - newLeft + 1;
    }
    if (mode.includes('s')) {
        const newBottom = Math.max(startRect.r, mr);
        rowSpan = newBottom - startRect.r + 1;
    }
    if (mode.includes('n')) {
        const newTop = Math.min(startBottom, mr);
        r = newTop;
        rowSpan = startBottom - newTop + 1;
    }

    _dragState.currentRect = { r, c, rowSpan, colSpan };
    showResizeGhost(_dragState.currentRect);
}

function onResizeEnd() {
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
    document.body.classList.remove('resizing-zone');
    hideResizeGhost();

    if (!_dragState) return;
    const { zoneIdx, startRect, currentRect } = _dragState;
    _dragState = null;

    if (startRect.r === currentRect.r &&
        startRect.c === currentRect.c &&
        startRect.rowSpan === currentRect.rowSpan &&
        startRect.colSpan === currentRect.colSpan) {
        return;
    }
    applyZoneRect(zoneIdx, currentRect);
}

function showResizeGhost(rect) {
    const grid = document.getElementById('gridPreview');
    let ghost = document.getElementById('resizeGhost');
    if (!ghost) {
        ghost = document.createElement('div');
        ghost.id = 'resizeGhost';
        ghost.className = 'resize-ghost';
        grid.appendChild(ghost);
    }
    ghost.style.gridRow = `${rect.r + 1} / span ${rect.rowSpan}`;
    ghost.style.gridColumn = `${rect.c + 1} / span ${rect.colSpan}`;
}

function hideResizeGhost() {
    const ghost = document.getElementById('resizeGhost');
    if (ghost) ghost.remove();
}

function applyZoneRect(zoneIdx, newRect) {
    const { rows, cols } = S.layout.grid;

    const owner = Array.from({ length: rows }, () => Array(cols).fill(-1));
    S.zonePositionMap.forEach((pos, i) => {
        if (!pos) return;
        for (let dr = 0; dr < pos.rowSpan; dr++)
            for (let dc = 0; dc < pos.colSpan; dc++)
                owner[pos.r + dr][pos.c + dc] = i;
    });

    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (owner[r][c] === zoneIdx) owner[r][c] = -1;

    for (let dr = 0; dr < newRect.rowSpan; dr++)
        for (let dc = 0; dc < newRect.colSpan; dc++)
            owner[newRect.r + dr][newRect.c + dc] = zoneIdx;

    const oldZones = S.layout.zones;
    const processed = Array.from({ length: rows }, () => Array(cols).fill(false));
    const newZones = [];
    let newSelectedIdx = null;
    const ownerEmitted = new Set();

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (processed[r][c]) continue;
            const id = owner[r][c];
            let cc = c;
            while (cc < cols && !processed[r][cc] && owner[r][cc] === id) cc++;
            const rectColSpan = cc - c;
            let rr = r + 1;
            while (rr < rows) {
                let ok = true;
                for (let k = c; k < c + rectColSpan; k++) {
                    if (processed[rr][k] || owner[rr][k] !== id) { ok = false; break; }
                }
                if (!ok) break;
                rr++;
            }
            const rectRowSpan = rr - r;

            for (let dr = 0; dr < rectRowSpan; dr++)
                for (let dc = 0; dc < rectColSpan; dc++)
                    processed[r + dr][c + dc] = true;

            let zone;
            if (id === -1) {
                zone = makeEmptyZone(Date.now() + newZones.length);
            } else if (!ownerEmitted.has(id)) {
                ownerEmitted.add(id);
                zone = { ...oldZones[id] };
                if (id === zoneIdx) newSelectedIdx = newZones.length;
            } else {
                zone = makeEmptyZone(Date.now() + newZones.length);
            }
            zone.col_span = rectColSpan;
            zone.row_span = rectRowSpan;
            newZones.push(zone);
        }
    }

    S.layout.zones = newZones;
    S.selectedZone = newSelectedIdx;
    renderGrid();
    renderPanel();
    markDirty();
    updateLivePreview();
}

/* ── Selection ──────────────────────────────────────────────── */
function selectZone(i) {
    S.selectedZone = i;
    S.activeTab = 'content';
    renderGrid();
    renderPanel();
}

function deselectZone() {
    if (S.selectedZone === null) return;
    S.selectedZone = null;
    renderGrid();
    renderPanel();
}

/* ── Panel Rendering ────────────────────────────────────────── */
function renderPanel() {
    const panel = document.getElementById('panelContent');
    if (S.selectedZone !== null) {
        // Note: innerHTML is used here with escaped content (escHtml) for all user-provided values
        panel.innerHTML = renderZonePanel(S.selectedZone);
        bindZonePanelEvents(S.selectedZone);
    } else {
        panel.innerHTML = renderGlobalPanel();
        bindGlobalPanelEvents();
    }
}

/* ── Global Panel (accordion sections) ──────────────────────── */
function renderGlobalPanel() {
    const bg = S.background;
    const tb = S.layout.top_bar;

    const bgTypeChecked = (t) => bg.type === t ? 'checked' : '';

    return `
    <div class="panel-header">
        <h3>Display Settings</h3>
        <p class="panel-subtitle">Global configuration</p>
    </div>
    <div class="panel-body">
        <!-- Display Info -->
        <div class="accordion-section">
            <button class="accordion-header" onclick="toggleAccordion(this)">
                <i class="material-icons">info</i>
                <span>Display Info</span>
                <i class="material-icons accordion-chevron">expand_more</i>
            </button>
            <div class="accordion-content">
                <div class="form-field">
                    <label>Description</label>
                    <textarea id="panelDescription" rows="2">${escHtml(S.description)}</textarea>
                </div>
            </div>
        </div>

        <!-- Appearance / Background -->
        <div class="accordion-section">
            <button class="accordion-header" onclick="toggleAccordion(this)">
                <i class="material-icons">palette</i>
                <span>Background</span>
                <i class="material-icons accordion-chevron">expand_more</i>
            </button>
            <div class="accordion-content">
                <div class="form-field">
                    <label>Type</label>
                    <div class="option-cards" id="bgTypeCards">
                        <label class="option-card ${bg.type === 'color' ? 'active' : ''}">
                            <input type="radio" name="bgType" value="color" ${bgTypeChecked('color')}> Color
                        </label>
                        <label class="option-card ${bg.type === 'gradient' ? 'active' : ''}">
                            <input type="radio" name="bgType" value="gradient" ${bgTypeChecked('gradient')}> Gradient
                        </label>
                        <label class="option-card ${bg.type === 'image' ? 'active' : ''}">
                            <input type="radio" name="bgType" value="image" ${bgTypeChecked('image')}> Image
                        </label>
                    </div>
                </div>
                <div id="bgColorField" class="form-field" style="display:${bg.type === 'color' ? 'block' : 'none'}">
                    <label>Color</label>
                    <input type="color" id="bgColor" value="${bg.type === 'color' ? (bg.value || '#1a1a1a') : '#1a1a1a'}">
                </div>
                <div id="bgGradientField" class="form-field" style="display:${bg.type === 'gradient' ? 'block' : 'none'}">
                    <label>CSS Gradient</label>
                    <input type="text" id="bgGradient" value="${escHtml(bg.type === 'gradient' ? (bg.value || '') : 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)')}" placeholder="linear-gradient(...)">
                    <div id="gradientPreview" class="gradient-preview" style="background:${bg.type === 'gradient' ? bg.value : ''}"></div>
                </div>
                <div id="bgImageField" class="form-field" style="display:${bg.type === 'image' ? 'block' : 'none'}">
                    <label>Upload Image</label>
                    <input type="file" id="bgImage" accept="image/*">
                    <div id="currentImage">${bg.type === 'image' && bg.value ? `<img src="${bg.value}" alt="Background" style="max-width:100%;margin-top:0.5rem;border-radius:var(--radius-sm);">` : ''}</div>
                </div>
            </div>
        </div>

        <!-- Typography -->
        <div class="accordion-section">
            <button class="accordion-header" onclick="toggleAccordion(this)">
                <i class="material-icons">text_fields</i>
                <span>Typography</span>
                <i class="material-icons accordion-chevron">expand_more</i>
            </button>
            <div class="accordion-content">
                <div class="form-field">
                    <label>Global Font</label>
                    <select id="globalFont">${FONT_OPTIONS}</select>
                </div>
            </div>
        </div>

        <!-- Top Bar -->
        <div class="accordion-section">
            <button class="accordion-header" onclick="toggleAccordion(this)">
                <i class="material-icons">web_asset</i>
                <span>Top Bar</span>
                <i class="material-icons accordion-chevron">expand_more</i>
            </button>
            <div class="accordion-content">
                <div class="form-field">
                    <label>Mode</label>
                    <select id="topBarMode">
                        <option value="visible" ${tb.mode === 'visible' ? 'selected' : ''}>Always Visible</option>
                        <option value="overlay" ${tb.mode === 'overlay' ? 'selected' : ''}>Overlay (transparent)</option>
                        <option value="auto-hide" ${tb.mode === 'auto-hide' ? 'selected' : ''}>Auto-Hide</option>
                        <option value="hidden" ${tb.mode === 'hidden' ? 'selected' : ''}>Hidden</option>
                    </select>
                </div>
                <div class="form-field">
                    <label><input type="checkbox" id="topBarShowSeconds" ${tb.show_seconds !== false ? 'checked' : ''}> Show seconds in clock</label>
                </div>
                <div class="form-field">
                    <label>Font Weight</label>
                    <select id="topBarFontWeight">
                        <option value="200" ${tb.font_weight === '200' ? 'selected' : ''}>Thin (200)</option>
                        <option value="300" ${tb.font_weight === '300' ? 'selected' : ''}>Light (300)</option>
                        <option value="400" ${tb.font_weight === '400' ? 'selected' : ''}>Regular (400)</option>
                        <option value="500" ${tb.font_weight === '500' ? 'selected' : ''}>Medium (500)</option>
                        <option value="600" ${tb.font_weight === '600' ? 'selected' : ''}>Semi-Bold (600)</option>
                        <option value="700" ${(tb.font_weight || '700') === '700' ? 'selected' : ''}>Bold (700)</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Screen / Resolution -->
        <div class="accordion-section">
            <button class="accordion-header" onclick="toggleAccordion(this)">
                <i class="material-icons">aspect_ratio</i>
                <span>Screen</span>
                <i class="material-icons accordion-chevron">expand_more</i>
            </button>
            <div class="accordion-content">
                <div class="form-field">
                    <label>Resolution Preset</label>
                    <select id="resolutionPreset">
                        <option value="">Custom</option>
                        <optgroup label="Landscape">
                            <option value="1920x1080">1920 x 1080 (Full HD)</option>
                            <option value="2560x1440">2560 x 1440 (QHD)</option>
                            <option value="3840x2160">3840 x 2160 (4K UHD)</option>
                            <option value="1366x768">1366 x 768</option>
                            <option value="1280x720">1280 x 720 (HD)</option>
                            <option value="1280x800">1280 x 800 (WXGA)</option>
                        </optgroup>
                        <optgroup label="Square / Ultrawide">
                            <option value="1080x1080">1080 x 1080 (Square)</option>
                            <option value="2560x1080">2560 x 1080 (Ultrawide)</option>
                            <option value="3440x1440">3440 x 1440 (Ultrawide QHD)</option>
                        </optgroup>
                    </select>
                </div>
                <div class="form-field">
                    <label>Width x Height (px)</label>
                    <div style="display:flex;gap:0.5rem;align-items:center;">
                        <input type="number" id="resWidth" value="${S.layout.resolution_w || 1920}" min="1" style="flex:1;">
                        <span style="color:var(--text-light);">x</span>
                        <input type="number" id="resHeight" value="${S.layout.resolution_h || 1080}" min="1" style="flex:1;">
                    </div>
                </div>
                <p class="help-text">For portrait displays, use a portrait resolution (e.g. 1080 x 1920)</p>
            </div>
        </div>

        <!-- OLED Burn-in Protection -->
        <div class="accordion-section">
            <button class="accordion-header" onclick="toggleAccordion(this)">
                <i class="material-icons">screen_lock_portrait</i>
                <span>Burn-in Protection</span>
                <i class="material-icons accordion-chevron">expand_more</i>
            </button>
            <div class="accordion-content">
                <div class="form-field">
                    <label><input type="checkbox" id="burnInEnabled" ${S.layout.burn_in_protection ? 'checked' : ''}> Enable pixel shift</label>
                    <p class="help-text">Subtly shifts content every few minutes to prevent OLED burn-in</p>
                </div>
                <div class="form-field" id="burnInIntervalField" style="display:${S.layout.burn_in_protection ? 'block' : 'none'}">
                    <label>Shift Interval (minutes)</label>
                    <input type="number" id="burnInInterval" value="${S.layout.burn_in_interval || 10}" min="1" max="60">
                </div>
            </div>
        </div>
    </div>`;
}

function bindGlobalPanelEvents() {
    // Description
    const desc = document.getElementById('panelDescription');
    if (desc) desc.addEventListener('input', () => { S.description = desc.value; markDirty(); });

    // Background type
    document.querySelectorAll('#bgTypeCards input[name="bgType"]').forEach(radio => {
        radio.addEventListener('change', function () {
            document.querySelectorAll('#bgTypeCards .option-card').forEach(c => c.classList.remove('active'));
            this.closest('.option-card').classList.add('active');
            const v = this.value;
            document.getElementById('bgColorField').style.display = v === 'color' ? 'block' : 'none';
            document.getElementById('bgGradientField').style.display = v === 'gradient' ? 'block' : 'none';
            document.getElementById('bgImageField').style.display = v === 'image' ? 'block' : 'none';
            updateBackground();
        });
    });

    // Background color
    const bgColor = document.getElementById('bgColor');
    if (bgColor) bgColor.addEventListener('input', updateBackground);

    // Background gradient
    const bgGrad = document.getElementById('bgGradient');
    if (bgGrad) bgGrad.addEventListener('input', () => {
        const preview = document.getElementById('gradientPreview');
        if (preview) preview.style.background = bgGrad.value;
        updateBackground();
    });

    // Background image upload
    const bgImg = document.getElementById('bgImage');
    if (bgImg) bgImg.addEventListener('change', handleImageUpload);

    // Global font
    const gf = document.getElementById('globalFont');
    if (gf) {
        gf.value = S.layout.global_font;
        gf.addEventListener('change', () => {
            S.layout.global_font = gf.value;
            markDirty();
            updateLivePreview();
        });
    }

    // Top bar
    const tbMode = document.getElementById('topBarMode');
    const tbSec = document.getElementById('topBarShowSeconds');
    const tbWeight = document.getElementById('topBarFontWeight');
    const updateTb = () => {
        S.layout.top_bar = {
            mode: tbMode.value,
            show_seconds: tbSec.checked,
            font_weight: tbWeight.value
        };
        markDirty();
        updateLivePreview();
    };
    if (tbMode) tbMode.addEventListener('change', updateTb);
    if (tbSec) tbSec.addEventListener('change', updateTb);
    if (tbWeight) tbWeight.addEventListener('change', updateTb);

    // Resolution
    const resPreset = document.getElementById('resolutionPreset');
    const resW = document.getElementById('resWidth');
    const resH = document.getElementById('resHeight');
    const applyResolution = () => {
        const w = parseInt(resW.value) || 1920;
        const h = parseInt(resH.value) || 1080;
        S.layout.resolution_w = w;
        S.layout.resolution_h = h;
        S.layout.orientation = w >= h ? 'landscape' : 'portrait';
        renderGrid();
        markDirty();
        updateLivePreview();
    };
    if (resPreset) resPreset.addEventListener('change', () => {
        if (resPreset.value) {
            const [w, h] = resPreset.value.split('x').map(Number);
            resW.value = w;
            resH.value = h;
        }
        applyResolution();
    });
    if (resW) resW.addEventListener('change', () => {
        if (resPreset) resPreset.value = '';
        applyResolution();
    });
    if (resH) resH.addEventListener('change', () => {
        if (resPreset) resPreset.value = '';
        applyResolution();
    });
    // Select matching preset on load
    if (resPreset && S.layout.resolution_w && S.layout.resolution_h) {
        resPreset.value = `${S.layout.resolution_w}x${S.layout.resolution_h}`;
    }

    // Burn-in protection
    const burnIn = document.getElementById('burnInEnabled');
    const burnInInterval = document.getElementById('burnInInterval');
    const burnInIntervalField = document.getElementById('burnInIntervalField');
    if (burnIn) burnIn.addEventListener('change', () => {
        S.layout.burn_in_protection = burnIn.checked;
        if (burnInIntervalField) burnInIntervalField.style.display = burnIn.checked ? 'block' : 'none';
        markDirty();
        updateLivePreview();
    });
    if (burnInInterval) burnInInterval.addEventListener('change', () => {
        S.layout.burn_in_interval = parseInt(burnInInterval.value) || 10;
        markDirty();
        updateLivePreview();
    });
}

function updateBackground() {
    const checked = document.querySelector('#bgTypeCards input[name="bgType"]:checked');
    if (!checked) return;
    const bgType = checked.value;

    if (bgType === 'color') {
        S.background = { type: 'color', value: document.getElementById('bgColor').value };
    } else if (bgType === 'gradient') {
        S.background = { type: 'gradient', value: document.getElementById('bgGradient').value };
    } else {
        S.background = { type: 'image', value: S.background.value || '' };
    }
    markDirty();
    updateLivePreview();
}

async function handleImageUpload() {
    const file = document.getElementById('bgImage').files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        const result = await response.json();
        if (result.success) {
            S.background.value = result.url;
            document.getElementById('currentImage').innerHTML =
                `<img src="${result.url}" alt="Background" style="max-width:100%;margin-top:0.5rem;border-radius:var(--radius-sm);">`;
            markDirty();
            updateLivePreview();
        } else {
            showToast('Upload failed: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('Upload error: ' + error.message, 'error');
    }
}

/* ── Zone Panel (tabs: Content / Style / Schedule) ──────────── */
function renderZonePanel(i) {
    const zone = S.layout.zones[i];
    const tab = S.activeTab;

    return `
    <div class="panel-header">
        <button class="panel-back-btn" onclick="deselectZone()">
            <i class="material-icons">arrow_back</i> Display Settings
        </button>
        <div class="panel-header-row">
            <h3>Zone ${i + 1}</h3>
        </div>
        <div class="panel-tabs">
            <button class="panel-tab ${tab === 'content' ? 'active' : ''}" onclick="switchTab('content')">Content</button>
            <button class="panel-tab ${tab === 'style' ? 'active' : ''}" onclick="switchTab('style')">Style</button>
            <button class="panel-tab ${tab === 'schedule' ? 'active' : ''}" onclick="switchTab('schedule')">Schedule</button>
        </div>
    </div>
    <div class="panel-body">
        <div class="tab-pane ${tab === 'content' ? 'active' : ''}" id="tabContent">
            ${renderContentTab(zone, i)}
        </div>
        <div class="tab-pane ${tab === 'style' ? 'active' : ''}" id="tabStyle">
            ${renderStyleTab(zone, i)}
        </div>
        <div class="tab-pane ${tab === 'schedule' ? 'active' : ''}" id="tabSchedule">
            ${renderScheduleTab(zone, i)}
        </div>
    </div>`;
}

function switchTab(name) {
    S.activeTab = name;
    renderPanel();
}

/* ── Content Tab ────────────────────────────────────────────── */
function renderContentTab(zone, i) {
    // Type picker cards
    let typeCards = '<div class="zone-type-grid">';
    ZONE_TYPES.forEach(t => {
        const active = zone.type === t.value ? 'active' : '';
        typeCards += `<div class="zone-type-card ${active}" onclick="setZoneType(${i}, '${t.value}')">
            <i class="material-icons">${t.icon}</i>
            <span>${t.label}</span>
        </div>`;
    });
    typeCards += '</div>';

    return typeCards + renderTypeSettings(zone, i);
}

function renderTypeSettings(zone, i) {
    const type = zone.type;
    let html = '';

    if (type === 'empty') return '<p class="help-text" style="margin-top:1rem;">Select a zone type above to configure content.</p>';

    if (type === 'clock') {
        html += `
        <div class="form-field">
            <label>Time Format</label>
            <select data-field="time_format">
                <option value="24h" ${zone.time_format === '24h' ? 'selected' : ''}>24 Hour (14:30:45)</option>
                <option value="12h" ${zone.time_format === '12h' ? 'selected' : ''}>12 Hour (2:30:45 PM)</option>
            </select>
        </div>
        <div class="form-field">
            <label>Date Format</label>
            <select data-field="date_format">
                <option value="full" ${zone.date_format === 'full' ? 'selected' : ''}>Full (Monday, June 22, 2025)</option>
                <option value="short" ${zone.date_format === 'short' ? 'selected' : ''}>Short (Jun 22, 2025)</option>
                <option value="numeric" ${zone.date_format === 'numeric' ? 'selected' : ''}>Numeric (22/06/2025)</option>
                <option value="iso" ${zone.date_format === 'iso' ? 'selected' : ''}>ISO (2025-06-22)</option>
                <option value="custom" ${zone.date_format === 'custom' ? 'selected' : ''}>Custom (DD/MM/YYYY)</option>
            </select>
        </div>`;
    }

    if (type === 'timer') {
        const isDatetime = !!zone.timer_target;
        html += `
        <div class="form-field">
            <label>Timer Type</label>
            <div class="option-cards" id="timerTypeCards">
                <label class="option-card ${!isDatetime ? 'active' : ''}">
                    <input type="radio" name="timerType" value="duration" ${!isDatetime ? 'checked' : ''}> Duration
                </label>
                <label class="option-card ${isDatetime ? 'active' : ''}">
                    <input type="radio" name="timerType" value="datetime" ${isDatetime ? 'checked' : ''}> Date &amp; Time
                </label>
            </div>
        </div>
        <div id="timerDurationFields" style="display:${isDatetime ? 'none' : 'block'}">
            <div class="form-field">
                <label>Duration (minutes)</label>
                <input type="number" data-field="content" value="${escHtml(zone.content)}" min="1" placeholder="15">
                <p class="help-text">Minutes to count down. Displays MM:SS, HH:MM:SS, or Dd HH:MM:SS automatically. (1 day = 1440 min)</p>
            </div>
        </div>
        <div id="timerDatetimeFields" style="display:${isDatetime ? 'block' : 'none'}">
            <div class="form-field">
                <label>Target Date &amp; Time</label>
                <input type="datetime-local" data-field="timer_target" value="${escHtml(zone.timer_target || '')}">
                <p class="help-text">Counts down to this exact date and time.</p>
            </div>
        </div>
        <div class="form-field">
            <label><input type="checkbox" data-field="timer_show_hms" ${zone.timer_show_hms !== false ? 'checked' : ''}> Show HH:MM:SS alongside days</label>
            <p class="help-text">When unchecked, shows only "Xd" while counting down days.</p>
        </div>
        <div class="form-field">
            <label>Label Text</label>
            <input type="text" data-field="timer_label" value="${escHtml(zone.timer_label || '')}" placeholder="Countdown Timer">
        </div>`;
    }

    if (type === 'announcement') {
        html += `
        <div class="form-field">
            <label>Announcement Text</label>
            <textarea data-field="content" rows="4" placeholder="Enter text...">${escHtml(zone.content)}</textarea>
            <p class="help-text">Use separate lines for multiple announcements (crossfade/marquee modes).</p>
        </div>
        <div class="form-field">
            <label>Display Mode</label>
            <select data-field="announcement_mode">
                <option value="static" ${zone.announcement_mode === 'static' ? 'selected' : ''}>Static</option>
                <option value="crossfade" ${zone.announcement_mode === 'crossfade' ? 'selected' : ''}>Crossfade (rotate)</option>
                <option value="marquee" ${zone.announcement_mode === 'marquee' ? 'selected' : ''}>Marquee (scroll)</option>
            </select>
        </div>
        <div class="form-field">
            <label>Rotation Interval (seconds)</label>
            <input type="number" data-field="announcement_interval" value="${zone.announcement_interval || 5}" min="1" max="60">
            <p class="help-text">Used for crossfade mode only</p>
        </div>`;
    }

    if (type === 'weather') {
        html += `
        <div class="form-field">
            <label>Location</label>
            <div style="display:flex;gap:0.5rem;">
                <input type="text" id="weatherLocation" value="${escHtml(zone.weather_location || '')}" placeholder="Enter city name...">
                <button type="button" class="btn btn-primary btn-sm" onclick="searchWeatherLocation()">Search</button>
            </div>
        </div>
        <div class="form-field">
            <label>Temperature Units</label>
            <select data-field="weather_units">
                <option value="C" ${zone.weather_units === 'C' ? 'selected' : ''}>Celsius (&deg;C)</option>
                <option value="F" ${zone.weather_units === 'F' ? 'selected' : ''}>Fahrenheit (&deg;F)</option>
            </select>
        </div>
        <div class="form-field">
            <label>Refresh Interval (minutes)</label>
            <input type="number" data-field="weather_refresh" value="${zone.weather_refresh || 30}" min="5" max="120">
        </div>
        <div class="form-field">
            <label>Coordinates</label>
            <div style="display:flex;gap:0.5rem;">
                <input type="text" id="weatherLat" value="${zone.weather_lat || ''}" placeholder="Lat" readonly style="background:var(--background-secondary);">
                <input type="text" id="weatherLon" value="${zone.weather_lon || ''}" placeholder="Lon" readonly style="background:var(--background-secondary);">
            </div>
            <p class="help-text">Set automatically when you search for a location</p>
        </div>`;
    }

    if (type === 'rss') {
        html += `
        <div class="form-field">
            <label>RSS Feed URL</label>
            <input type="text" data-field="content" value="${escHtml(zone.content)}" placeholder="https://example.com/rss.xml">
        </div>
        <div class="form-field">
            <label>Display Mode</label>
            <select data-field="rss_mode">
                <option value="list" ${zone.rss_mode === 'list' ? 'selected' : ''}>List (show all)</option>
                <option value="rotate" ${zone.rss_mode === 'rotate' ? 'selected' : ''}>Rotate (one at a time)</option>
                <option value="ticker" ${zone.rss_mode === 'ticker' ? 'selected' : ''}>Ticker (horizontal scroll)</option>
            </select>
        </div>
        <div class="form-field">
            <label>Rotation Interval (seconds)</label>
            <input type="number" data-field="rss_interval" value="${zone.rss_interval || 5}" min="1" max="60">
            <p class="help-text">Used for rotate mode only</p>
        </div>
        <div class="form-field">
            <label>Feed Refresh Interval (minutes)</label>
            <input type="number" data-field="rss_refresh" value="${zone.rss_refresh || 5}" min="1" max="60">
            <p class="help-text">How often to re-fetch the RSS feed for new articles</p>
        </div>`;
    }

    if (type === 'image') {
        html += `
        <div class="form-field">
            <label>Image URL</label>
            <input type="text" data-field="content" value="${escHtml(zone.content)}" placeholder="https://example.com/image.jpg">
            <p class="help-text">Enter the URL of the image to display</p>
        </div>`;
    }

    if (type === 'video') {
        html += `
        <div class="form-field">
            <label>Video URL</label>
            <input type="text" data-field="content" value="${escHtml(zone.content)}" placeholder="https://example.com/video.mp4">
            <p class="help-text">MP4, WebM, or YouTube URL</p>
        </div>
        <div class="form-field">
            <label><input type="checkbox" data-field="mute" ${zone.mute === false ? '' : 'checked'}> Mute Video</label>
            <p class="help-text">Uncheck to enable audio playback</p>
            <p class="help-text"><i class="material-icons" style="font-size:14px;vertical-align:middle;">info</i> Audio is always muted in preview</p>
        </div>`;
    }

    if (type === 'slideshow') {
        html += `
        <div class="form-field">
            <label>Slideshow Configuration</label>
            <textarea data-field="content" rows="4" placeholder="8:\nimage1.jpg\nimage2.jpg">${escHtml(zone.content)}</textarea>
            <p class="help-text">First line can be "8:" to set 8-second timer. Then list image URLs, one per line.</p>
        </div>`;
    }

    if (type === 'iframe') {
        html += `
        <div class="form-field">
            <label>iFrame Embed Code or URL</label>
            <textarea data-field="content" rows="4" placeholder="<iframe ...> or https://...">${escHtml(zone.content)}</textarea>
            <p class="help-text">Enter the full iframe HTML code or just a URL</p>
        </div>`;
    }

    return html;
}

function setZoneType(i, type) {
    S.layout.zones[i].type = type;
    markDirty();
    renderGrid();
    renderPanel();
    updateLivePreview();
}

/* ── Style Tab ──────────────────────────────────────────────── */
function renderStyleTab(zone) {
    const bg = zone.background || { type: 'transparent' };
    const bgTypeActive = (t) => bg.type === t ? 'active' : '';

    return `
    <!-- Typography -->
    <div class="accordion-section open">
        <button class="accordion-header" onclick="toggleAccordion(this)">
            <i class="material-icons">text_fields</i>
            <span>Typography</span>
            <i class="material-icons accordion-chevron">expand_more</i>
        </button>
        <div class="accordion-content">
            <div class="form-field">
                <label>Font Family</label>
                <select data-field="font_family">
                    <option value="">Use Global Font</option>
                    ${FONT_OPTIONS}
                </select>
            </div>
            <div class="form-field">
                <label>Font Size</label>
                <input type="text" data-field="font_size" value="${escHtml(zone.font_size || '16px')}" placeholder="16px, 1.2em, etc.">
            </div>
            <div class="form-field">
                <label>Font Color</label>
                <div style="display:flex;align-items:center;gap:8px;">
                    <input type="checkbox" id="fontColorEnabled" ${zone.font_color ? 'checked' : ''}>
                    <input type="color" id="fontColorPicker" value="${zone.font_color || '#ffffff'}" ${!zone.font_color ? 'disabled' : ''} style="width:40px;height:28px;padding:2px;border-radius:4px;cursor:pointer;">
                    <span id="fontColorLabel" style="font-size:0.8em;color:var(--text-muted)">${zone.font_color || 'Default'}</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Background -->
    <div class="accordion-section open">
        <button class="accordion-header" onclick="toggleAccordion(this)">
            <i class="material-icons">format_paint</i>
            <span>Background</span>
            <i class="material-icons accordion-chevron">expand_more</i>
        </button>
        <div class="accordion-content">
            <div class="form-field">
                <div class="option-cards" id="zoneBgTypeCards">
                    <label class="option-card ${bgTypeActive('transparent')}">
                        <input type="radio" name="zoneBgType" value="transparent" ${bg.type === 'transparent' ? 'checked' : ''}> None
                    </label>
                    <label class="option-card ${bgTypeActive('color')}">
                        <input type="radio" name="zoneBgType" value="color" ${bg.type === 'color' ? 'checked' : ''}> Color
                    </label>
                    <label class="option-card ${bgTypeActive('glassmorphism')}">
                        <input type="radio" name="zoneBgType" value="glassmorphism" ${bg.type === 'glassmorphism' ? 'checked' : ''}> Glass
                    </label>
                    <label class="option-card ${bgTypeActive('image')}">
                        <input type="radio" name="zoneBgType" value="image" ${bg.type === 'image' ? 'checked' : ''}> Image
                    </label>
                </div>
            </div>

            <div id="zoneBgColorFields" style="display:${bg.type === 'color' ? 'block' : 'none'}">
                <div class="form-field">
                    <label>Color</label>
                    <input type="color" id="zoneBackgroundColor" value="${bg.color || '#000000'}">
                </div>
                <div class="form-field">
                    <label>Opacity <span id="zoneBgOpacityValue">${Math.round((bg.opacity || 0.8) * 100)}%</span></label>
                    <input type="range" id="zoneBgOpacity" min="0" max="1" step="0.1" value="${bg.opacity || 0.8}">
                </div>
            </div>

            <div id="zoneBgGlassFields" style="display:${bg.type === 'glassmorphism' ? 'block' : 'none'}">
                <div class="form-field">
                    <label>Blur <span id="zoneBlurValue">${bg.blur || 10}px</span></label>
                    <input type="range" id="zoneBlur" min="0" max="50" value="${bg.blur || 10}">
                </div>
                <div class="form-field">
                    <label>Glass Opacity <span id="zoneGlassOpacityValue">${Math.round((bg.opacity || 0.2) * 100)}%</span></label>
                    <input type="range" id="zoneGlassOpacity" min="0" max="1" step="0.1" value="${bg.opacity || 0.2}">
                </div>
            </div>

            <div id="zoneBgImageFields" style="display:${bg.type === 'image' ? 'block' : 'none'}">
                <div class="form-field">
                    <label>Upload Background Image</label>
                    <input type="file" id="zoneBackgroundImage" accept="image/*">
                    <div id="currentZoneImage">${bg.type === 'image' && bg.url ? `<img src="${bg.url}" alt="Zone Background" style="max-width:100%;margin-top:0.5rem;border-radius:var(--radius-sm);">` : ''}</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Opacity -->
    <div class="accordion-section open">
        <button class="accordion-header" onclick="toggleAccordion(this)">
            <i class="material-icons">opacity</i>
            <span>Zone Opacity</span>
            <i class="material-icons accordion-chevron">expand_more</i>
        </button>
        <div class="accordion-content">
            <div class="form-field">
                <label>Opacity <span id="opacityValue">${Math.round(zone.opacity * 100)}%</span></label>
                <input type="range" data-field="opacity" min="0" max="1" step="0.1" value="${zone.opacity}">
            </div>
        </div>
    </div>`;
}

/* ── Schedule Tab ───────────────────────────────────────────── */
function renderScheduleTab(zone) {
    const schedulableTypes = ['announcement', 'image', 'video', 'slideshow', 'iframe', 'rss'];
    if (!schedulableTypes.includes(zone.type)) {
        return '<p class="help-text" style="padding:1rem;">Schedules are available for announcement, image, video, slideshow, iframe, and RSS zone types.</p>';
    }

    let entries = '';
    if (zone.schedule && Array.isArray(zone.schedule)) {
        zone.schedule.forEach((entry, idx) => {
            entries += renderScheduleEntry(entry, idx);
        });
    }

    return `
    <p class="help-text" style="margin-bottom:1rem;">Schedule different content for specific times and days. Base content is used when no schedule matches.</p>
    <div id="scheduleEntries">${entries}</div>
    <button type="button" class="btn btn-secondary btn-sm" onclick="addScheduleEntry()" style="margin-top:0.5rem;">
        <i class="material-icons">add</i> Add Schedule
    </button>`;
}

function renderScheduleEntry(entry, idx) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let daysHtml = dayNames.map((d, i) => {
        const checked = entry && entry.days && entry.days.includes(i) ? 'checked' : '';
        return `<label class="schedule-day-label"><input type="checkbox" class="schedule-day" value="${i}" ${checked}>${d}</label>`;
    }).join('');

    return `
    <div class="schedule-entry" data-idx="${idx}">
        <div class="schedule-entry-header">
            <input type="text" class="schedule-label" placeholder="Label" value="${escHtml(entry ? (entry.label || '') : '')}">
            <input type="time" class="schedule-start" value="${entry ? (entry.time_start || '') : ''}">
            <span>to</span>
            <input type="time" class="schedule-end" value="${entry ? (entry.time_end || '') : ''}">
            <button type="button" class="btn btn-danger btn-sm" onclick="removeScheduleEntry(this)">
                <i class="material-icons">close</i>
            </button>
        </div>
        <div class="schedule-days">${daysHtml}</div>
        <textarea class="schedule-content" rows="2" placeholder="Override content...">${escHtml(entry ? (entry.content || '') : '')}</textarea>
    </div>`;
}

function addScheduleEntry(entry = null) {
    const container = document.getElementById('scheduleEntries');
    if (!container) return;
    const idx = container.children.length;
    const div = document.createElement('div');
    div.innerHTML = renderScheduleEntry(entry || {}, idx);
    // Append the inner child
    const entryEl = div.firstElementChild;
    container.appendChild(entryEl);

    // Bind change events to auto-save schedule
    entryEl.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('change', () => autoSaveSchedule());
    });
}

function removeScheduleEntry(btn) {
    btn.closest('.schedule-entry').remove();
    autoSaveSchedule();
}

function autoSaveSchedule() {
    if (S.selectedZone === null) return;
    const zone = S.layout.zones[S.selectedZone];
    zone.schedule = collectScheduleEntries();
    markDirty();
    updateLivePreview();
}

function collectScheduleEntries() {
    const entries = [];
    document.querySelectorAll('.schedule-entry').forEach(div => {
        const days = [];
        div.querySelectorAll('.schedule-day:checked').forEach(cb => days.push(parseInt(cb.value)));
        entries.push({
            label: div.querySelector('.schedule-label').value,
            time_start: div.querySelector('.schedule-start').value,
            time_end: div.querySelector('.schedule-end').value,
            days: days,
            content: div.querySelector('.schedule-content').value
        });
    });
    return entries;
}

/* ── Zone Panel Event Binding (auto-save on change) ─────────── */
function bindZonePanelEvents(i) {
    const zone = S.layout.zones[i];
    const panel = document.getElementById('panelContent');

    // All data-field elements: auto-save on change/input
    panel.querySelectorAll('[data-field]').forEach(el => {
        const field = el.dataset.field;
        const event = (el.tagName === 'SELECT' || el.type === 'range' || el.type === 'number' || el.type === 'checkbox') ? 'change' : 'input';

        // Set current value for selects
        if (el.tagName === 'SELECT' && zone[field] !== undefined) {
            el.value = zone[field];
        }

        el.addEventListener(event, () => {
            let val = el.type === 'checkbox' ? el.checked : el.value;
            if (el.type === 'range' || el.type === 'number') val = parseFloat(val);
            zone[field] = val;
            markDirty();

            // Update display labels for range sliders
            if (field === 'opacity') {
                const label = document.getElementById('opacityValue');
                if (label) label.textContent = Math.round(val * 100) + '%';
            }

            renderGrid();
            updateLivePreview();
        });
    });

    // Timer type cards (duration vs. date & time)
    panel.querySelectorAll('#timerTypeCards input[name="timerType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            panel.querySelectorAll('#timerTypeCards .option-card').forEach(c => c.classList.remove('active'));
            this.closest('.option-card').classList.add('active');
            const isDt = this.value === 'datetime';
            panel.querySelector('#timerDurationFields').style.display = isDt ? 'none' : 'block';
            panel.querySelector('#timerDatetimeFields').style.display = isDt ? 'block' : 'none';
            if (!isDt) { zone.timer_target = ''; markDirty(); renderGrid(); updateLivePreview(); }
        });
    });

    // Zone background type cards
    panel.querySelectorAll('#zoneBgTypeCards input[name="zoneBgType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            document.querySelectorAll('#zoneBgTypeCards .option-card').forEach(c => c.classList.remove('active'));
            this.closest('.option-card').classList.add('active');
            const v = this.value;
            document.getElementById('zoneBgColorFields').style.display = v === 'color' ? 'block' : 'none';
            document.getElementById('zoneBgGlassFields').style.display = v === 'glassmorphism' ? 'block' : 'none';
            document.getElementById('zoneBgImageFields').style.display = v === 'image' ? 'block' : 'none';
            autoSaveZoneBg(i);
        });
    });

    // Zone background value changes
    ['zoneBackgroundColor', 'zoneBgOpacity', 'zoneBlur', 'zoneGlassOpacity'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            autoSaveZoneBg(i);
            // Update labels
            if (id === 'zoneBgOpacity') {
                const lbl = document.getElementById('zoneBgOpacityValue');
                if (lbl) lbl.textContent = Math.round(el.value * 100) + '%';
            }
            if (id === 'zoneGlassOpacity') {
                const lbl = document.getElementById('zoneGlassOpacityValue');
                if (lbl) lbl.textContent = Math.round(el.value * 100) + '%';
            }
            if (id === 'zoneBlur') {
                const lbl = document.getElementById('zoneBlurValue');
                if (lbl) lbl.textContent = el.value + 'px';
            }
        });
    });

    // Font color toggle + picker
    const fontColorEnabled = panel.querySelector('#fontColorEnabled');
    const fontColorPicker = panel.querySelector('#fontColorPicker');
    const fontColorLabel = panel.querySelector('#fontColorLabel');
    if (fontColorEnabled && fontColorPicker) {
        fontColorEnabled.addEventListener('change', () => {
            if (fontColorEnabled.checked) {
                fontColorPicker.disabled = false;
                zone.font_color = fontColorPicker.value;
            } else {
                fontColorPicker.disabled = true;
                zone.font_color = '';
            }
            if (fontColorLabel) fontColorLabel.textContent = zone.font_color || 'Default';
            markDirty();
            renderGrid();
            updateLivePreview();
        });
        fontColorPicker.addEventListener('input', () => {
            zone.font_color = fontColorPicker.value;
            if (fontColorLabel) fontColorLabel.textContent = zone.font_color;
            markDirty();
            renderGrid();
            updateLivePreview();
        });
    }

    // Zone background image
    const zbImg = document.getElementById('zoneBackgroundImage');
    if (zbImg) zbImg.addEventListener('change', () => handleZoneImageUpload(i));

    // Bind existing schedule entries
    panel.querySelectorAll('.schedule-entry input, .schedule-entry textarea').forEach(el => {
        el.addEventListener('change', () => autoSaveSchedule());
    });
}

function autoSaveZoneBg(i) {
    const zone = S.layout.zones[i];
    const checked = document.querySelector('#zoneBgTypeCards input[name="zoneBgType"]:checked');
    if (!checked) return;
    const bgType = checked.value;
    zone.background = { type: bgType };

    if (bgType === 'color') {
        zone.background.color = document.getElementById('zoneBackgroundColor').value;
        zone.background.opacity = parseFloat(document.getElementById('zoneBgOpacity').value);
    } else if (bgType === 'glassmorphism') {
        zone.background.blur = parseInt(document.getElementById('zoneBlur').value);
        zone.background.opacity = parseFloat(document.getElementById('zoneGlassOpacity').value);
    } else if (bgType === 'image') {
        const img = document.getElementById('zoneBackgroundImage');
        if (img && img.dataset.url) zone.background.url = img.dataset.url;
    }

    markDirty();
    updateLivePreview();
}

async function handleZoneImageUpload(i) {
    const file = document.getElementById('zoneBackgroundImage').files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        const result = await response.json();
        if (result.success) {
            document.getElementById('currentZoneImage').innerHTML =
                `<img src="${result.url}" alt="Zone Background" style="max-width:100%;margin-top:0.5rem;border-radius:var(--radius-sm);">`;
            document.getElementById('zoneBackgroundImage').dataset.url = result.url;
            S.layout.zones[i].background = { type: 'image', url: result.url };
            markDirty();
            updateLivePreview();
        } else {
            showToast('Upload failed: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('Upload error: ' + error.message, 'error');
    }
}

/* ── Weather Location Search ────────────────────────────────── */
async function searchWeatherLocation() {
    const locationInput = document.getElementById('weatherLocation');
    const name = locationInput.value.trim();
    if (!name) return;

    try {
        const response = await fetch(`/api/geocode?name=${encodeURIComponent(name)}`);
        const data = await response.json();

        if (data.error) {
            showToast('Geocode error: ' + data.error, 'error');
            return;
        }
        if (!data.results || data.results.length === 0) {
            showToast('No locations found for "' + name + '"', 'error');
            return;
        }

        const r = data.results[0];
        document.getElementById('weatherLat').value = r.latitude;
        document.getElementById('weatherLon').value = r.longitude;
        const displayName = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
        locationInput.value = displayName;

        if (S.selectedZone !== null) {
            const zone = S.layout.zones[S.selectedZone];
            zone.weather_location = displayName;
            zone.weather_lat = String(r.latitude);
            zone.weather_lon = String(r.longitude);
            markDirty();
            updateLivePreview();
        }
    } catch (error) {
        showToast('Search error: ' + error.message, 'error');
    }
}

/* ── Accordion ──────────────────────────────────────────────── */
function toggleAccordion(btn) {
    const section = btn.closest('.accordion-section');
    section.classList.toggle('open');
}

/* ── Live Preview ───────────────────────────────────────────── */
let _previewDebounceTimer = null;

function updateLivePreview() {
    clearTimeout(_previewDebounceTimer);
    _previewDebounceTimer = setTimeout(() => {
        const iframe = document.getElementById('livePreview');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'configUpdate',
                layout: S.layout,
                background: S.background
            }, '*');
        }
    }, 500);
}

function refreshPreview() {
    const iframe = document.getElementById('livePreview');
    if (iframe) iframe.src = iframe.src;
}

function togglePreview() {
    const slideout = document.getElementById('previewSlideout');
    slideout.classList.toggle('visible');
}

/* ── Save Configuration ─────────────────────────────────────── */
async function saveConfig() {
    const displayName = document.getElementById('displayName').value;

    try {
        await signageApp.request(`/api/display/${S.displayId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: displayName,
                description: S.description,
                layout_config: S.layout,
                background_config: S.background
            })
        });

        S.dirty = false;
        document.getElementById('saveBtn').classList.remove('save-pulse');
        showToast('Configuration saved! Displays will update in real-time.');
    } catch (error) {
        showToast('Error saving: ' + error.message, 'error');
    }
}

/* ── Utility ────────────────────────────────────────────────── */
function escHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
