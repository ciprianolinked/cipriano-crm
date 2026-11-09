/**
 * Paginação A4 por blocos medidos no navegador.
 * Nunca fatia uma imagem no meio de uma linha: parágrafos são divididos em palavras,
 * tabelas em linhas (com cabeçalho repetido) e blocos pequenos permanecem inteiros.
 */
export type PaginatedContent = { pages: string[]; sourceBlocks: number; outputBlocks: number };

type Fragment = {
  el: HTMLElement;
  height: number;
  keepNext: boolean;
  atomic: boolean;
  kind: "block" | "table";
};

const px = (value: string) => Number.parseFloat(value) || 0;

function outerHeight(el: HTMLElement): number {
  const style = getComputedStyle(el);
  return el.getBoundingClientRect().height + px(style.marginTop) + px(style.marginBottom);
}

function clone(el: HTMLElement): HTMLElement {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.removeAttribute("id");
  copy.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  return copy;
}

function measure(el: HTMLElement, probe: HTMLElement): number {
  probe.appendChild(el);
  const height = outerHeight(el);
  probe.removeChild(el);
  return height;
}

function textHost(el: HTMLElement, selector?: string): HTMLElement {
  if (selector) {
    const found = el.querySelector<HTMLElement>(selector);
    if (found) return found;
  }
  return (el.querySelector<HTMLElement>("[data-pdf-text]") ?? el);
}

function tokensOf(text: string): string[] {
  return text.match(/\S+\s*/g) ?? (text.trim() ? [text] : []);
}

function lineHeightOf(el: HTMLElement): number {
  const style = getComputedStyle(el);
  return px(style.lineHeight) || px(style.fontSize) * 1.5 || 18;
}

function minimumTextHeight(el: HTMLElement): number {
  const host = textHost(el, el.dataset.pdfTextSelector);
  return Math.min(72, lineHeightOf(host) * 2 + 8);
}

/** Divide texto preservando espaços internos e quebras de linha; devolve o resto para a próxima folha. */
function splitTextOnce(
  el: HTMLElement,
  limit: number,
  probe: HTMLElement,
  hostSelector?: string,
  clearSiblingCells = false,
): { first: HTMLElement; rest: HTMLElement | null } | null {
  const originalHost = textHost(el, hostSelector ?? el.dataset.pdfTextSelector);
  const tokens = tokensOf(originalHost.textContent ?? "");
  if (!tokens.length || limit < lineHeightOf(originalHost)) return null;

  const candidate = clone(el);
  const candidateHost = textHost(candidate, hostSelector ?? el.dataset.pdfTextSelector);
  const fits = (count: number) => {
    candidateHost.textContent = tokens.slice(0, count).join("");
    return measure(candidate, probe) <= limit + 0.5;
  };

  let low = 1;
  let high = tokens.length;
  let best = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (fits(mid)) { best = mid; low = mid + 1; } else high = mid - 1;
  }
  if (!best) return null;

  // Evita deixar apenas uma linha órfã no início da próxima página quando há espaço para reequilibrar.
  if (best < tokens.length) {
    const remainder = clone(el);
    const remainderHost = textHost(remainder, hostSelector ?? el.dataset.pdfTextSelector);
    const minHeight = lineHeightOf(originalHost) * 1.75;
    while (best > 2) {
      remainderHost.textContent = tokens.slice(best).join("");
      if (measure(remainder, probe) >= minHeight) break;
      best -= 1;
    }
  }

  const first = clone(el);
  textHost(first, hostSelector ?? el.dataset.pdfTextSelector).textContent = tokens.slice(0, best).join("").trimEnd();
  first.dataset.pdfPart = "start";
  if (best >= tokens.length) return { first, rest: null };

  const rest = clone(el);
  const restHost = textHost(rest, hostSelector ?? el.dataset.pdfTextSelector);
  restHost.textContent = tokens.slice(best).join("").replace(/^\s+/, "");
  rest.dataset.pdfPart = "continued";
  if (clearSiblingCells) {
    const originalCell = originalHost.closest("td, th");
    const restCell = restHost.closest("td, th");
    if (originalCell && restCell) {
      const index = Array.from(originalCell.parentElement?.children ?? []).indexOf(originalCell);
      Array.from(restCell.parentElement?.children ?? []).forEach((cell, i) => {
        if (i !== index) (cell as HTMLElement).textContent = "";
      });
    }
  }
  return { first, rest };
}

function scaleAtomic(el: HTMLElement, limit: number, probe: HTMLElement): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.dataset.pdfBlock = "";
  wrapper.dataset.pdfScaled = "true";
  const inner = clone(el);
  const natural = measure(inner, probe);
  const ratio = Math.min(1, Math.max(0.1, limit / Math.max(natural, 1)));
  inner.style.transform = `scale(${ratio})`;
  inner.style.transformOrigin = "top left";
  inner.style.width = `${100 / ratio}%`;
  wrapper.style.height = `${Math.ceil(natural * ratio)}px`;
  wrapper.style.overflow = "hidden";
  wrapper.appendChild(inner);
  return wrapper;
}

type TableInfo = {
  block: HTMLElement;
  rows: HTMLElement[];
  caption: string;
};

function tableInfo(block: HTMLElement): TableInfo | null {
  const table = block.querySelector("table");
  const body = table?.querySelector("tbody");
  if (!table || !body) return null;
  return { block, rows: Array.from(body.children).filter((row): row is HTMLElement => row instanceof HTMLElement), caption: block.dataset.pdfCaption ?? "Continuação" };
}

function buildTableChunk(info: TableInfo, rows: HTMLElement[], continued: boolean): HTMLElement {
  const chunk = clone(info.block);
  const table = chunk.querySelector("table")!;
  const body = table.querySelector("tbody")!;
  body.replaceChildren(...rows.map((row) => clone(row)));
  if (continued) {
    const note = document.createElement("div");
    note.className = "a4-table-continuation";
    note.textContent = `${info.caption} · continuação`;
    table.before(note);
  }
  return chunk;
}

function tableOverhead(info: TableInfo, continued: boolean, probe: HTMLElement): number {
  return measure(buildTableChunk(info, [], continued), probe);
}

function tableRowHeight(info: TableInfo, row: HTMLElement, probe: HTMLElement): number {
  if (row.isConnected) return outerHeight(row);
  return Math.max(0, measure(buildTableChunk(info, [row], false), probe) - tableOverhead(info, false, probe));
}

function minimumTableHeight(info: TableInfo, probe: HTMLElement): number {
  const overhead = tableOverhead(info, false, probe);
  const first = info.rows[0];
  return overhead + (first ? tableRowHeight(info, first, probe) : 0);
}

export function paginateContent(root: HTMLElement, capacity: number): PaginatedContent {
  const probe = document.createElement("div");
  probe.className = `${root.className} a4-probe`;
  probe.style.position = "absolute";
  probe.style.left = "0";
  probe.style.top = "0";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  const rootStyle = getComputedStyle(root);
  const horizontalPadding = (Number.parseFloat(rootStyle.paddingLeft) || 0) + (Number.parseFloat(rootStyle.paddingRight) || 0);
  probe.style.width = `${root.clientWidth - horizontalPadding}px`;
  probe.style.padding = "0";
  probe.style.margin = "0";
  root.parentElement?.appendChild(probe);

  const collect = (parent: HTMLElement): HTMLElement[] => Array.from(parent.children).flatMap((child) => {
    if (!(child instanceof HTMLElement) || child.hasAttribute("data-pdf-ignore")) return [];
    if (child.hasAttribute("data-pdf-block")) return [child];
    return child.children.length ? collect(child) : [child];
  });
  const source = collect(root);
  const queue: Fragment[] = source.map((el) => ({
    el,
    height: outerHeight(el),
    keepNext: el.hasAttribute("data-pdf-keep-next"),
    atomic: el.hasAttribute("data-pdf-atomic"),
    kind: el.dataset.pdfKind === "table" && tableInfo(el) ? "table" : "block",
  }));

  const pages: HTMLElement[][] = [];
  let current: HTMLElement[] = [];
  let used = 0;
  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    used = 0;
  };
  const add = (el: HTMLElement, height?: number) => {
    current.push(el);
    used += height ?? measure(el, probe);
  };

  try {
    while (queue.length) {
      const fragment = queue.shift()!;
      if (fragment.kind === "table") {
        const info = tableInfo(fragment.el)!;
        let cursor = 0;
        let continued = false;
        while (cursor < info.rows.length) {
          const remaining = capacity - used;
          const overhead = tableOverhead(info, continued, probe);
          let end = cursor;
          let estimated = overhead;
          while (end < info.rows.length) {
            const row = info.rows[end];
            let required = tableRowHeight(info, row, probe);
            const next = info.rows[end + 1];
            if (next?.hasAttribute("data-pdf-keep-with-previous")) required += tableRowHeight(info, next, probe);
            if (estimated + required > remaining + 0.5 && end > cursor) break;
            if (estimated + required > remaining + 0.5 && end === cursor) break;
            estimated += tableRowHeight(info, row, probe);
            end += 1;
          }

          if (end === cursor) {
            if (current.length) { flush(); continue; }
            const cells = Array.from(info.rows[cursor].querySelectorAll<HTMLElement>("td, th"));
            const targetIndex = cells.reduce((best, cell, i) => (cell.textContent?.length ?? 0) > (cells[best]?.textContent?.length ?? 0) ? i : best, 0);
            const split = splitTextOnce(info.rows[cursor], Math.max(40, remaining - overhead), probe, `td:nth-child(${targetIndex + 1}), th:nth-child(${targetIndex + 1})`, true);
            if (split) {
              const chunk = buildTableChunk(info, [split.first], continued);
              add(chunk);
              if (split.rest) { info.rows[cursor] = split.rest; flush(); continued = true; continue; }
              cursor += 1;
            } else {
              const chunk = buildTableChunk(info, [info.rows[cursor]], continued);
              add(scaleAtomic(chunk, capacity, probe));
              cursor += 1;
            }
          } else {
            let chunk = buildTableChunk(info, info.rows.slice(cursor, end), continued);
            let height = measure(chunk, probe);
            while (height > remaining + 0.5 && end - cursor > 1) {
              end -= 1;
              chunk = buildTableChunk(info, info.rows.slice(cursor, end), continued);
              height = measure(chunk, probe);
            }
            if (height > remaining + 0.5) {
              if (current.length) { flush(); continue; }
              const cells = Array.from(info.rows[cursor].querySelectorAll<HTMLElement>("td, th"));
              const targetIndex = cells.reduce((best, cell, i) => (cell.textContent?.length ?? 0) > (cells[best]?.textContent?.length ?? 0) ? i : best, 0);
              const split = splitTextOnce(info.rows[cursor], Math.max(40, capacity - overhead), probe, `td:nth-child(${targetIndex + 1}), th:nth-child(${targetIndex + 1})`, true);
              if (split) {
                add(buildTableChunk(info, [split.first], continued));
                if (split.rest) { info.rows[cursor] = split.rest; flush(); continued = true; continue; }
                cursor += 1;
              } else {
                add(scaleAtomic(chunk, capacity, probe));
                cursor += 1;
              }
            } else {
              add(chunk, height);
              cursor = end;
            }
          }
          if (cursor < info.rows.length) { flush(); continued = true; }
        }
        continue;
      }

      const remaining = capacity - used;
      if (fragment.keepNext && current.length) {
        const next = queue[0];
        const nextMinimum = next ? (next.kind === "table" ? minimumTableHeight(tableInfo(next.el)!, probe) : Math.min(next.height, minimumTextHeight(next.el))) : 0;
        if (used + fragment.height + nextMinimum > capacity) flush();
      }

      if (fragment.height <= capacity - used + 0.5) {
        add(clone(fragment.el), fragment.height);
        continue;
      }
      if (fragment.atomic) {
        if (current.length) flush();
        if (fragment.height <= capacity) add(clone(fragment.el), fragment.height);
        else add(scaleAtomic(fragment.el, capacity, probe));
        continue;
      }

      const limit = current.length ? capacity - used : capacity;
      if (current.length && limit < minimumTextHeight(fragment.el)) { flush(); queue.unshift(fragment); continue; }
      const split = splitTextOnce(fragment.el, limit, probe);
      if (!split) {
        if (current.length) { flush(); queue.unshift(fragment); continue; }
        add(scaleAtomic(fragment.el, capacity, probe));
        continue;
      }
      add(split.first);
      if (split.rest) {
        flush();
        queue.unshift({ ...fragment, el: split.rest, height: measure(split.rest, probe) });
      }
    }
    flush();
    return {
      pages: pages.map((page) => page.map((el) => el.outerHTML).join("")),
      sourceBlocks: source.length,
      outputBlocks: pages.reduce((total, page) => total + page.length, 0),
    };
  } finally {
    probe.remove();
  }
}
