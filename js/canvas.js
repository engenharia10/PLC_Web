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
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this.render();
        };
        window.addEventListener('resize', resize);
        // Initial
        requestAnimationFrame(resize);
    }

    _setupEvents() {
        this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this._onWheel(e));

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

    // ===== Scroll state =====
    scrollY = 0;
    maxScrollY = 0;
    isDragging = false;
    isResizing = false;
    dragElement = null;
    resizeElement = null;
    dragOffsetX = 0;
    dragOffsetY = 0;
    startX = 0;
    startY = 0;

    _onWheel(e) {
        e.preventDefault();
        this.scrollY += e.deltaY * 0.5;
        this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScrollY));
        this.render();
    }

    _getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top + this.scrollY
        };
    }

    // Wrappers para Touch Events (Mobile) usando a mesma lógica de Mouse Events
    _onTouchStart(e) {
        if (e.touches && e.touches.length > 0) {
            e.preventDefault(); // Evita scroll do navegador ao tocar no canvas
            const touch = e.touches[0];
            const simEl = { clientX: touch.clientX, clientY: touch.clientY };
            this._onMouseDown(simEl);
        }
    }

    _onTouchMove(e) {
        if (e.touches && e.touches.length > 0) {
            e.preventDefault(); // Impede o "puxar para recarregar" e scroll
            const touch = e.touches[0];
            const simEvent = { clientX: touch.clientX, clientY: touch.clientY };
            this._onMouseMove(simEvent);
        }
    }

    _onTouchEnd(e) {
        // Usa as coordenadas finais salvas (via dragOffsetY/etc), a lógica de up não usa a posição do mouse na versão atual do PWA
        this._onMouseUp(e);
    }

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
                // Tolerance 8px around the right vertical line
                if (Math.abs(pos.x - ex) < 8 && pos.y >= sy - 10 && pos.y <= ey + 10) {
                    this.isResizing = true;
                    this.resizeElement = el;
                    app.selectedElement = el; // select it
                    app.updateProperties();
                    this.render();
                    return; // Stop here, we are resizing
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
                
                // Check if click is near left or bottom line
                const onLeft = (Math.abs(pos.x - sx) < 8 && pos.y >= sy && pos.y <= ey);
                const onBottom = (Math.abs(pos.y - ey) < 8 && pos.x >= sx && pos.x <= ex);
                if (onLeft || onBottom) {
                    found = el;
                    break;
                }
            } else {
                const hw = COMPONENT_HALF_WIDTH;
                if (pos.x >= el.x - hw && pos.x <= el.x + hw &&
                    pos.y >= el.y - 18 && pos.y <= el.y + 18) {
                    found = el;
                    break;
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
        
        // Handle resizing branch
        if (this.isResizing && this.resizeElement) {
            let newWidth = pos.x - this.resizeElement.x;
            newWidth = Math.max(40, Math.round(newWidth / 10) * 10); // min 40px, snap 10px
            this.resizeElement.width = newWidth;
            this.render();
            return;
        }

        // Handle dragging elements
        if (this.isDragging && this.dragElement) {
            // Adicionado threshold de 5px para não registrar o leve tremor do dedo "touch" como arraste
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

            // Snap to branch_y (prioridade sobre rung), igual ao Python
            if (this.dragElement.type !== 'branch') {
                let snapped = false;
                for (const b of app.elements) {
                    if (b.type !== 'branch' || b === this.dragElement) continue;
                    const bY = b.branch_y || (b.y + 80);
                    const bX1 = b.x - 100;
                    const bX2 = (b.x + (b.width || 200)) + 100;
                    if (Math.abs(this.dragElement.y - bY) < 20 &&
                        this.dragElement.x >= bX1 && this.dragElement.x <= bX2) {
                        this.dragElement.y = bY;
                        snapped = true;
                        break;
                    }
                }
                // Snap to rung Y (se não snappou em branch)
                if (!snapped) {
                    let closestRung = null;
                    let closestDist = Infinity;
                    for (const rung of app.rungs) {
                        const d = Math.abs(this.dragElement.y - rung.y);
                        if (d < closestDist) { closestDist = d; closestRung = rung; }
                    }
                    if (closestRung && closestDist < 25) {
                        this.dragElement.y = closestRung.y;
                    }
                }
            } else {
                // Branch: só snap de rung no rung_y
                let closestRung = null;
                let closestDist = Infinity;
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
        
        // Handle hover cursor change (for resize handle)
        let cursor = 'default';
        for (let i = this.app.elements.length - 1; i >= 0; i--) {
            const el = this.app.elements[i];
            if (el.type === 'branch') {
                const ex = el.x + (el.width || 120);
                const sy = el.y; // approximate
                const ey = el.y + 60; // approximate
                if (Math.abs(pos.x - ex) < 6 && pos.y >= sy - 10 && pos.y <= ey + 10) {
                    cursor = 'ew-resize';
                    break;
                }
            } else {
                const hw = COMPONENT_HALF_WIDTH;
                if (pos.x >= el.x - hw && pos.x <= el.x + hw && pos.y >= el.y - 18 && pos.y <= el.y + 18) {
                    cursor = 'pointer';
                    break;
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
        if (wasClick && this.app.selectedElement) {
            this.app.updateProperties();
        }
        this.render();
    }

    // ===== Drop from palette =====
    handleDrop(compType, clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        let x = clientX - rect.left;
        let y = clientY - rect.top + this.scrollY;

        // Snap to grid
        x = Math.round(x / 10) * 10;
        y = Math.round(y / 10) * 10;

        // Snap to nearest branch_y (igual ao Python: tolerância 20px Y, 100px X)
        // Deve ter prioridade sobre snap de rung para elementos não-branch
        let snappedToBranch = false;
        if (compType !== 'branch') {
            for (const b of this.app.elements) {
                if (b.type !== 'branch') continue;
                const bY = b.branch_y || (b.y + 80);
                const bX1 = b.x - 100;
                const bX2 = (b.x + (b.width || 200)) + 100;
                if (Math.abs(y - bY) < 20 && x >= bX1 && x <= bX2) {
                    y = bY;
                    snappedToBranch = true;
                    break;
                }
            }
        }

        // Snap to nearest rung (se não snappou em branch)
        if (!snappedToBranch) {
            let closestRung = null;
            let closestDist = Infinity;
            for (const rung of this.app.rungs) {
                const d = Math.abs(y - rung.y);
                if (d < closestDist) { closestDist = d; closestRung = rung; }
            }
            if (closestRung && closestDist < 40) {
                y = closestRung.y;
            }
        }

        // Clamp X
        x = Math.max(this.LEFT_MARGIN + 40, Math.min(this.width - this.RIGHT_MARGIN - 40, x));

        const element = createNewElement(compType, x, y, this.app.elements);

        // Branch: define rung_y e branch_y igual ao Python
        // branch_corner_y = branch_start_y + 80 (padrão do Python)
        if (compType === 'branch') {
            element.rung_y = y;
            // Se já há branches nessa rung, empilha 80px abaixo do mais baixo
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

    // ===== Rendering =====
    render() {
        const ctx = this.ctx;
        const w = this.width;
        const t = this.app.theme;

        // Calcula altura total — inclui branch_y para não cortar conteúdo
        let maxY = 200;
        if (this.app.rungs.length > 0) {
            maxY = Math.max(maxY, ...this.app.rungs.map(r => r.y));
        }
        if (this.app.elements.length > 0) {
            maxY = Math.max(maxY, ...this.app.elements.map(e => {
                if (e.type === 'branch') return e.branch_y || (e.y + 80);
                return e.y;
            }));
        }
        const totalH = Math.max(maxY + 200, this.height);
        this.maxScrollY = Math.max(0, (maxY + 200) - this.height);

        ctx.save();
        ctx.translate(0, -this.scrollY);

        // Fundo
        ctx.fillStyle = t.get('CANVAS_BG');
        ctx.fillRect(0, this.scrollY, w, this.height);

        // Power rails (do ladder.py)
        this._drawPowerRails(totalH);

        // Rungs
        this._drawRungs();

        // Branches
        this._drawBranches();

        // Elements
        this._drawElements();

        // Selection
        this._drawSelection();

        ctx.restore();

        // Scrollbar visual (sobre o canvas, fora do translate)
        this._drawScrollbar();
    }

    _drawScrollbar() {
        if (this.maxScrollY <= 0) return;
        const ctx = this.ctx;
        const h = this.height;
        const w = this.width;
        const sbW = 8;
        const sbX = w - sbW;

        // Track
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(sbX, 0, sbW, h);

        // Thumb
        const totalContent = this.maxScrollY + h;
        const thumbH = Math.max(24, (h / totalContent) * h);
        const thumbY = (this.scrollY / this.maxScrollY) * (h - thumbH);

        ctx.fillStyle = 'rgba(148,163,184,0.45)';
        ctx.beginPath();
        ctx.roundRect(sbX + 1, thumbY + 2, sbW - 2, thumbH - 4, 4);
        ctx.fill();
    }

    _drawPowerRails(totalH) {
        const ctx = this.ctx;
        const t = this.app.theme;
        const color = t.get('POWER_RAIL_COLOR');

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;

        // Rail esquerdo
        ctx.beginPath();
        ctx.moveTo(this.LEFT_MARGIN, 0);
        ctx.lineTo(this.LEFT_MARGIN, totalH);
        ctx.stroke();

        // Rail direito
        const rightX = this.width - this.RIGHT_MARGIN;
        ctx.beginPath();
        ctx.moveTo(rightX, 0);
        ctx.lineTo(rightX, totalH);
        ctx.stroke();
    }

    _drawRungs() {
        const ctx = this.ctx;
        const t = this.app.theme;
        const rungColor = t.get('RUNG_LINE_COLOR');
        const rightX = this.width - this.RIGHT_MARGIN;

        ctx.lineWidth = 2;

        for (const rung of this.app.rungs) {
            // Linha horizontal
            ctx.strokeStyle = rungColor;
            ctx.beginPath();
            ctx.moveTo(this.LEFT_MARGIN, rung.y);
            ctx.lineTo(rightX, rung.y);
            ctx.stroke();

            // Label (R0, R1, ...)
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
        const lineColor = t.get('RUNG_LINE_COLOR');

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;

        for (const el of this.app.elements) {
            if (el.type !== 'branch') continue;
            const sx = el.x;
            const sy = el.rung_y || el.y;
            const ey = el.branch_y || (el.y + 60);
            const ex = sx + (el.width || 120);

            // Vertical esquerda
            ctx.beginPath();
            ctx.moveTo(sx, sy); ctx.lineTo(sx, ey); ctx.stroke();
            // Horizontal inferior
            ctx.beginPath();
            ctx.moveTo(sx, ey); ctx.lineTo(ex, ey); ctx.stroke();
            // Vertical direita
            ctx.beginPath();
            ctx.moveTo(ex, ey); ctx.lineTo(ex, sy); ctx.stroke();
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
            const x = el.x;
            const y = el.y;
            const hw = COMPONENT_HALF_WIDTH;

            // Retângulo de fundo
            ctx.fillStyle = canvasBg;
            ctx.strokeStyle = iconColor;
            ctx.lineWidth = 1;
            ctx.fillRect(x - hw, y - 15, hw * 2, 30);
            ctx.strokeRect(x - hw, y - 15, hw * 2, 30);

            // Ícone
            const icon = getElementIcon(el);
            ctx.fillStyle = iconColor;
            ctx.font = 'bold 13px "Courier New", Courier, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(icon, x, y - 1);

            // Nome (abaixo da caixa)
            ctx.fillStyle = nameColor;
            ctx.font = 'bold 9px "Segoe UI"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(el.name, x, y + 17);
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
            const sx = el.x;
            const sy = el.rung_y || el.y;
            const ey = el.branch_y || (el.y + 60);
            const ex = sx + (el.width || 120);
            
            // Draw a bounding box for the branch
            ctx.strokeRect(sx - 4, sy - 4, (ex - sx) + 8, (ey - sy) + 8);
            
            // Draw resize handle on the right edge
            ctx.setLineDash([]);
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(ex - 4, (sy + ey)/2 - 5, 8, 10);
        } else {
            const hw = COMPONENT_HALF_WIDTH + 3;
            ctx.strokeRect(el.x - hw, el.y - 18, hw * 2, 36);
        }
        
        ctx.setLineDash([]);
    }
}

window.LadderCanvas = LadderCanvas;
