/**
 * Canvas — Motor de renderização do diagrama Ladder via Canvas 2D
 * Baseado em draw_ladder_rungs() e draw_element() do ladder.py
 */

class LadderCanvas {
    constructor(canvasEl, app) {
        this.canvas = canvasEl;
        this.ctx = canvasEl.getContext('2d');
        this.app = app;
        this.dpr = window.devicePixelRatio || 1;

        // Configurações de layout (do ladder.py)
        this.LEFT_MARGIN = 50;
        this.RIGHT_MARGIN = 20;
        this.FIRST_RUNG_Y = 80;
        this.RUNG_SPACING = 80;

        this._setupResize();
        this._setupEvents();
    }

    _setupResize() {
        const resize = () => {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = rect.width * this.dpr;
            this.canvas.height = rect.height * this.dpr;

            // Ajusta margens nos celulares para não desperdiçar espaço com trilhos azuis muito afastados
            const isMobile = window.innerWidth <= 600;
            this.LEFT_MARGIN = isMobile ? 35 : 50;
            this.RIGHT_MARGIN = isMobile ? 15 : 20;
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            // Clamp scroll after resize
            this.scrollX = Math.max(0, Math.min(this.scrollX, this.maxScrollX));
            this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScrollY));
            this.render();
        };
        window.addEventListener('resize', resize);
        requestAnimationFrame(resize);
    }

    _setupEvents() {
        this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });

        // Touch events for Mobile/Android support
        this.canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this._onTouchEnd(e));
    }

    get width() {
        return this.canvas.width / this.dpr;
    }

    get height() {
        return this.canvas.height / this.dpr;
    }

    // ===== Scroll / Zoom state =====
    scrollX = 0;
    scrollY = 0;
    maxScrollX = 0;
    maxScrollY = 0;
    scale = 1;
    minScale = 0.25;
    maxScale = 3;

    // Drag / resize state
    isDragging = false;
    isResizing = false;
    dragElement = null;
    resizeElement = null;
    dragOffsetX = 0;
    dragOffsetY = 0;
    startX = 0;
    startY = 0;

    // Pan state (touch / right-click)
    isPanning = false;
    panStartX = 0;
    panStartY = 0;
    panInitialScrollX = 0;
    panInitialScrollY = 0;

    // Pinch state
    _pinchActive = false;
    _pinchDist = 0;
    _pinchMidX = 0;
    _pinchMidY = 0;
    _pinchScrollX = 0;
    _pinchScrollY = 0;
    _pinchScale = 1;

    // World width (calculated per render)
    _worldWidth = 800;

    // ===== Wheel =====
    _onWheel(e) {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            // Zoom (Ctrl+scroll or trackpad pinch)
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            this._applyZoom(zoomFactor, mx, my);
        } else if (e.shiftKey) {
            // Horizontal scroll (Shift+scroll)
            this.scrollX += e.deltaY * 0.5;
            this.scrollX = Math.max(0, Math.min(this.scrollX, this.maxScrollX));
            this.render();
        } else {
            // Vertical scroll
            this.scrollY += e.deltaY * 0.5;
            this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScrollY));
            this.render();
        }
    }

    _applyZoom(factor, screenCenterX, screenCenterY) {
        const oldScale = this.scale;
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, oldScale * factor));
        if (newScale === oldScale) return;

        // Keep the screen point (screenCenterX, screenCenterY) fixed in world space
        const wx = (screenCenterX + this.scrollX) / oldScale;
        const wy = (screenCenterY + this.scrollY) / oldScale;
        this.scale = newScale;
        this.scrollX = wx * newScale - screenCenterX;
        this.scrollY = wy * newScale - screenCenterY;
        this.scrollX = Math.max(0, this.scrollX);
        this.scrollY = Math.max(0, this.scrollY);
        this.render();
        // Clamp after render (maxScroll updated inside render)
        this.scrollX = Math.max(0, Math.min(this.scrollX, this.maxScrollX));
        this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScrollY));
        this.render();
    }

    // ===== Coordinate conversion =====
    _getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left + this.scrollX) / this.scale,
            y: (e.clientY - rect.top  + this.scrollY) / this.scale
        };
    }

    // ===== Touch Events (Mobile) =====
    _onTouchStart(e) {
        e.preventDefault();

        if (e.touches.length === 2) {
            // Pinch-to-zoom start
            this._pinchActive = true;
            this.isPanning = false;
            this.isDragging = false;
            const t0 = e.touches[0], t1 = e.touches[1];
            this._pinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
            this._pinchMidX = (t0.clientX + t1.clientX) / 2;
            this._pinchMidY = (t0.clientY + t1.clientY) / 2;
            const rect = this.canvas.getBoundingClientRect();
            this._pinchMidX -= rect.left;
            this._pinchMidY -= rect.top;
            this._pinchScrollX = this.scrollX;
            this._pinchScrollY = this.scrollY;
            this._pinchScale = this.scale;
            return;
        }

        if (e.touches.length === 1) {
            this._pinchActive = false;
            const touch = e.touches[0];
            const simEl = { clientX: touch.clientX, clientY: touch.clientY };

            this.isPanning = false;
            this._onMouseDown(simEl);

            if (!this.isDragging && !this.isResizing) {
                this.isPanning = true;
                this.panStartX = touch.clientX;
                this.panStartY = touch.clientY;
                this.panInitialScrollX = this.scrollX;
                this.panInitialScrollY = this.scrollY;
                this._wasDragged = false;
            }
        }
    }

    _onTouchMove(e) {
        e.preventDefault();

        if (this._pinchActive && e.touches.length === 2) {
            const t0 = e.touches[0], t1 = e.touches[1];
            const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
            const rect = this.canvas.getBoundingClientRect();
            const midX = (t0.clientX + t1.clientX) / 2 - rect.left;
            const midY = (t0.clientY + t1.clientY) / 2 - rect.top;

            const factor = dist / this._pinchDist;
            const newScale = Math.max(this.minScale, Math.min(this.maxScale, this._pinchScale * factor));

            // Pan + zoom: keep original pinch midpoint in world space
            const wx = (this._pinchMidX + this._pinchScrollX) / this._pinchScale;
            const wy = (this._pinchMidY + this._pinchScrollY) / this._pinchScale;
            this.scale = newScale;
            this.scrollX = Math.max(0, wx * newScale - midX);
            this.scrollY = Math.max(0, wy * newScale - midY);
            this.render();
            return;
        }

        if (e.touches.length === 1) {
            const touch = e.touches[0];

            if (this.isPanning) {
                const dx = touch.clientX - this.panStartX;
                const dy = touch.clientY - this.panStartY;
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this._wasDragged = true;
                this.scrollX = Math.max(0, Math.min(this.maxScrollX, this.panInitialScrollX - dx));
                this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.panInitialScrollY - dy));
                this.render();
            } else {
                const simEvent = { clientX: touch.clientX, clientY: touch.clientY };
                this._onMouseMove(simEvent);
            }
        }
    }

    _onTouchEnd(e) {
        this._pinchActive = false;
        this.isPanning = false;
        this._onMouseUp(e);
    }

    // ===== Mouse Events =====
    _onMouseDown(e) {
        const pos = this._getCanvasPos(e);
        const app = this.app;

        // 1. Check for resize handle of branches (right edge)
        for (let i = app.elements.length - 1; i >= 0; i--) {
            const el = app.elements[i];
            if (el.type === 'branch') {
                const ex = el.x + (el.width || 120);
                const sy = el.y;
                const ey = el.y + 60;
                if (Math.abs(pos.x - ex) < 8 && pos.y >= sy - 10 && pos.y <= ey + 10) {
                    this.isResizing = true;
                    this.resizeElement = el;
                    app.selectedElement = el;
                    app.updateProperties();
                    this.render();
                    return;
                }
            }
        }

        // 2. Normal selection / dragging
        let found = null;
        for (let i = app.elements.length - 1; i >= 0; i--) {
            const el = app.elements[i];
            if (el.type === 'branch') {
                const sx = el.x;
                const sy = el.y;
                const ey = el.y + 60;
                const ex = sx + (el.width || 120);
                const onLeft   = (Math.abs(pos.x - sx) < 8 && pos.y >= sy && pos.y <= ey);
                const onBottom = (Math.abs(pos.y - ey) < 8 && pos.x >= sx && pos.x <= ex);
                if (onLeft || onBottom) { found = el; break; }
            } else {
                const hw = COMPONENT_HALF_WIDTH;
                if (pos.x >= el.x - hw && pos.x <= el.x + hw &&
                    pos.y >= el.y - 18  && pos.y <= el.y + 18) {
                    found = el; break;
                }
            }
        }

        if (found) {
            app.selectedElement = found;
            this.isDragging = true;
            this.dragElement = found;
            this.dragOffsetX = pos.x - found.x;
            this.dragOffsetY = pos.y - found.y;
            this.startX = pos.x;
            this.startY = pos.y;
            this._wasDragged = false;
        } else {
            app.selectedElement = null;
            app.updateProperties();
        }
        this.render();
    }

    _onMouseMove(e) {
        const pos = this._getCanvasPos(e);

        if (this.isResizing && this.resizeElement) {
            let newWidth = pos.x - this.resizeElement.x;
            newWidth = Math.max(40, Math.round(newWidth / 10) * 10);
            this.resizeElement.width = newWidth;
            this.render();
            return;
        }

        if (this.isDragging && this.dragElement) {
            if (!this._wasDragged) {
                if (Math.abs(pos.x - this.startX) > 5 || Math.abs(pos.y - this.startY) > 5) {
                    this._wasDragged = true;
                }
            }

            if (this._wasDragged) {
                const grid = 10;
                const app = this.app;
                this.dragElement.x = Math.round((pos.x - this.dragOffsetX) / grid) * grid;
                this.dragElement.y = Math.round((pos.y - this.dragOffsetY) / grid) * grid;

                if (this.dragElement.type !== 'branch') {
                    let snapped = false;
                    for (const b of app.elements) {
                        if (b.type !== 'branch' || b === this.dragElement) continue;
                        const bY  = b.branch_y || (b.y + 80);
                        const bX1 = b.x - 100;
                        const bX2 = (b.x + (b.width || 200)) + 100;
                        if (Math.abs(this.dragElement.y - bY) < 20 &&
                            this.dragElement.x >= bX1 && this.dragElement.x <= bX2) {
                            this.dragElement.y = bY;
                            snapped = true;
                            break;
                        }
                    }
                    if (!snapped) {
                        let closestRung = null, closestDist = Infinity;
                        for (const rung of app.rungs) {
                            const d = Math.abs(this.dragElement.y - rung.y);
                            if (d < closestDist) { closestDist = d; closestRung = rung; }
                        }
                        if (closestRung && closestDist < 25) this.dragElement.y = closestRung.y;
                    }
                } else {
                    let closestRung = null, closestDist = Infinity;
                    for (const rung of app.rungs) {
                        const d = Math.abs(this.dragElement.y - rung.y);
                        if (d < closestDist) { closestDist = d; closestRung = rung; }
                    }
                    if (closestRung && closestDist < 25) {
                        this.dragElement.y = closestRung.y;
                        this.dragElement.rung_y = closestRung.y;
                    }
                }
            }
            this.render();
            return;
        }

        // Hover cursor
        let cursor = 'default';
        for (let i = this.app.elements.length - 1; i >= 0; i--) {
            const el = this.app.elements[i];
            if (el.type === 'branch') {
                const ex = el.x + (el.width || 120);
                const sy = el.y, ey = el.y + 60;
                if (Math.abs(pos.x - ex) < 6 && pos.y >= sy - 10 && pos.y <= ey + 10) {
                    cursor = 'ew-resize'; break;
                }
            } else {
                const hw = COMPONENT_HALF_WIDTH;
                if (pos.x >= el.x - hw && pos.x <= el.x + hw &&
                    pos.y >= el.y - 18  && pos.y <= el.y + 18) {
                    cursor = 'pointer'; break;
                }
            }
        }
        this.canvas.style.cursor = cursor;
    }

    _onMouseUp(e) {
        const wasClick = this.isDragging && !this._wasDragged;
        this.isDragging = false;
        this.isResizing = false;
        this.dragElement = null;
        this.resizeElement = null;
        this._wasDragged = false;
        if (wasClick && this.app.selectedElement) this.app.updateProperties();
        this.render();
    }

    // ===== Drop from palette =====
    handleDrop(compType, clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        let x = (clientX - rect.left + this.scrollX) / this.scale;
        let y = (clientY - rect.top  + this.scrollY) / this.scale;

        x = Math.round(x / 10) * 10;
        y = Math.round(y / 10) * 10;

        let snappedToBranch = false;
        if (compType !== 'branch') {
            for (const b of this.app.elements) {
                if (b.type !== 'branch') continue;
                const bY  = b.branch_y || (b.y + 80);
                const bX1 = b.x - 100;
                const bX2 = (b.x + (b.width || 200)) + 100;
                if (Math.abs(y - bY) < 20 && x >= bX1 && x <= bX2) {
                    y = bY; snappedToBranch = true; break;
                }
            }
        }

        if (!snappedToBranch) {
            let closestRung = null, closestDist = Infinity;
            for (const rung of this.app.rungs) {
                const d = Math.abs(y - rung.y);
                if (d < closestDist) { closestDist = d; closestRung = rung; }
            }
            if (closestRung && closestDist < 40) y = closestRung.y;
        }

        x = Math.max(this.LEFT_MARGIN + 40, Math.min(this._worldWidth - this.RIGHT_MARGIN - 40, x));

        const element = createNewElement(compType, x, y, this.app.elements);

        if (compType === 'branch') {
            element.rung_y = y;
            const existing = this.app.elements.filter(
                e => e.type === 'branch' && Math.abs((e.rung_y || e.y) - y) < 5
            );
            if (existing.length > 0) {
                const maxBranchY = Math.max(...existing.map(e => e.branch_y || (e.y + 80)));
                element.branch_y = maxBranchY + 80;
            } else {
                element.branch_y = y + 80;
            }
        }

        this.app.elements.push(element);
        this.render();
    }

    // ===== Fit to screen =====
    fitToScreen() {
        const app = this.app;
        if (app.elements.length === 0 && app.rungs.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const el of app.elements) {
            const hw = COMPONENT_HALF_WIDTH;
            if (el.type === 'branch') {
                minX = Math.min(minX, el.x);
                maxX = Math.max(maxX, el.x + (el.width || 120));
                minY = Math.min(minY, el.y);
                maxY = Math.max(maxY, el.branch_y || (el.y + 80));
            } else {
                minX = Math.min(minX, el.x - hw);
                maxX = Math.max(maxX, el.x + hw);
                minY = Math.min(minY, el.y - 18);
                maxY = Math.max(maxY, el.y + 18);
            }
        }
        for (const r of app.rungs) {
            minY = Math.min(minY, r.y);
            maxY = Math.max(maxY, r.y);
        }
        if (!isFinite(minX)) return;

        const pad = 60;
        const contentW = maxX - minX + pad * 2;
        const contentH = maxY - minY + pad * 2;

        const scaleX = this.width  / contentW;
        const scaleY = this.height / contentH;
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, Math.min(scaleX, scaleY)));

        this.scrollX = Math.max(0, (minX - pad) * this.scale);
        this.scrollY = Math.max(0, (minY - pad) * this.scale);
        this.render();
    }

    // ===== Rendering =====
    render() {
        const ctx = this.ctx;
        const t = this.app.theme;

        // Compute world width from elements
        let maxElemX = this.width / this.scale;
        for (const el of this.app.elements) {
            if (el.type === 'branch') maxElemX = Math.max(maxElemX, el.x + (el.width || 120) + 80);
            else maxElemX = Math.max(maxElemX, el.x + COMPONENT_HALF_WIDTH + 80);
        }
        this._worldWidth = maxElemX + 50;

        // Compute world height (usa reduce para evitar stack overflow em arquivos grandes)
        let maxY = 200;
        for (const r of this.app.rungs) maxY = Math.max(maxY, r.y);
        for (const e of this.app.elements) {
            maxY = Math.max(maxY, e.type === 'branch' ? (e.branch_y || (e.y + 80)) : e.y);
        }

        const worldH = maxY + 600;
        this.maxScrollY = Math.max(0, worldH * this.scale - this.height);
        this.maxScrollX = Math.max(0, this._worldWidth * this.scale - this.width);

        // Clamp
        this.scrollX = Math.max(0, Math.min(this.scrollX, this.maxScrollX));
        this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScrollY));

        ctx.save();

        // Apply zoom + pan transform
        ctx.scale(this.scale, this.scale);
        ctx.translate(-this.scrollX / this.scale, -this.scrollY / this.scale);

        // Background
        ctx.fillStyle = t.get('CANVAS_BG');
        ctx.fillRect(
            this.scrollX / this.scale,
            this.scrollY / this.scale,
            this.width  / this.scale,
            this.height / this.scale
        );

        const totalH = worldH;

        this._drawPowerRails(totalH);
        this._drawRungs();
        this._drawBranches();
        this._drawElements();
        this._drawSelection();

        ctx.restore();

        // Scrollbars (screen-space, outside transform)
        this._drawScrollbarV();
        this._drawScrollbarH();
    }

    _drawScrollbarV() {
        if (this.maxScrollY <= 0) return;
        const ctx = this.ctx;
        const h = this.height, w = this.width;
        const sbW = 8, sbX = w - sbW;

        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(sbX, 0, sbW, h);

        const total = this.maxScrollY + h;
        const thumbH = Math.max(24, (h / total) * h);
        const thumbY = (this.scrollY / this.maxScrollY) * (h - thumbH);

        ctx.fillStyle = 'rgba(148,163,184,0.45)';
        ctx.beginPath();
        ctx.roundRect(sbX + 1, thumbY + 2, sbW - 2, thumbH - 4, 4);
        ctx.fill();
    }

    _drawScrollbarH() {
        if (this.maxScrollX <= 0) return;
        const ctx = this.ctx;
        const h = this.height, w = this.width;
        const sbH = 8, sbY = h - sbH;

        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(0, sbY, w, sbH);

        const total = this.maxScrollX + w;
        const thumbW = Math.max(24, (w / total) * w);
        const thumbX = (this.scrollX / this.maxScrollX) * (w - thumbW);

        ctx.fillStyle = 'rgba(148,163,184,0.45)';
        ctx.beginPath();
        ctx.roundRect(thumbX + 2, sbY + 1, thumbW - 4, sbH - 2, 4);
        ctx.fill();
    }

    _drawPowerRails(totalH) {
        const ctx = this.ctx;
        const t = this.app.theme;
        const color = t.get('POWER_RAIL_COLOR');
        const rightX = this._worldWidth - this.RIGHT_MARGIN;

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(this.LEFT_MARGIN, 0);
        ctx.lineTo(this.LEFT_MARGIN, totalH);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(rightX, 0);
        ctx.lineTo(rightX, totalH);
        ctx.stroke();
    }

    _drawRungs() {
        const ctx = this.ctx;
        const t = this.app.theme;
        const rungColor = t.get('RUNG_LINE_COLOR');
        const rightX = this._worldWidth - this.RIGHT_MARGIN;

        ctx.lineWidth = 2;

        for (const rung of this.app.rungs) {
            ctx.strokeStyle = rungColor;
            ctx.beginPath();
            ctx.moveTo(this.LEFT_MARGIN, rung.y);
            ctx.lineTo(rightX, rung.y);
            ctx.stroke();

            ctx.fillStyle = rungColor;
            ctx.font = 'bold 11px "Segoe UI"';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(`R${rung.index}`, this.LEFT_MARGIN - 8, rung.y);
        }
    }

    _drawBranches() {
        const ctx = this.ctx;
        const t = this.app.theme;
        ctx.strokeStyle = t.get('RUNG_LINE_COLOR');
        ctx.lineWidth = 2;

        for (const el of this.app.elements) {
            if (el.type !== 'branch') continue;
            const sx = el.x, sy = el.rung_y || el.y;
            const ey = el.branch_y || (el.y + 60);
            const ex = sx + (el.width || 120);

            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, ey); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sx, ey); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex, sy); ctx.stroke();
        }
    }

    _drawElements() {
        const ctx = this.ctx;
        const t = this.app.theme;
        const canvasBg = t.get('CANVAS_BG');
        const isDark = this.app.theme.isDark();
        const iconColor = isDark ? t.get('ST_FG') : '#1e293b';
        const nameColor = '#6366f1';

        for (const el of this.app.elements) {
            if (el.type === 'branch') continue;
            const x = el.x, y = el.y, hw = COMPONENT_HALF_WIDTH;

            // Fundo: verde escuro se ativo, normal caso contrário
            ctx.fillStyle = el._active ? '#052e16' : canvasBg;
            ctx.strokeStyle = el._active ? '#22c55e' : iconColor;
            ctx.lineWidth = el._active ? 2 : 1;
            ctx.fillRect(x - hw, y - 15, hw * 2, 30);
            ctx.strokeRect(x - hw, y - 15, hw * 2, 30);

            const icon = getElementIcon(el);
            ctx.fillStyle = el._active ? '#4ade80' : iconColor;
            ctx.font = 'bold 13px "Courier New", Courier, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(icon, x, y - 1);

            ctx.fillStyle = el._active ? '#4ade80' : nameColor;
            ctx.font = 'bold 9px "Segoe UI"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(el.name, x, y + 17);

            // Valor live (timer/counter/var) acima do elemento
            if (el._liveVal !== undefined) {
                ctx.fillStyle = '#38bdf8';
                ctx.font = 'bold 9px "Segoe UI"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(String(el._liveVal), x, y - 18);
            }
        }
    }

    _drawSelection() {
        const el = this.app.selectedElement;
        if (!el) return;

        const ctx = this.ctx;
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);

        if (el.type === 'branch') {
            const sx = el.x, sy = el.rung_y || el.y;
            const ey = el.branch_y || (el.y + 60);
            const ex = sx + (el.width || 120);
            ctx.strokeRect(sx - 4, sy - 4, (ex - sx) + 8, (ey - sy) + 8);
            ctx.setLineDash([]);
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(ex - 4, (sy + ey) / 2 - 5, 8, 10);
        } else {
            const hw = COMPONENT_HALF_WIDTH + 3;
            ctx.strokeRect(el.x - hw, el.y - 18, hw * 2, 36);
        }

        ctx.setLineDash([]);
    }
}

window.LadderCanvas = LadderCanvas;
