import type { Ref } from 'vue'

const ZOOM_MIN = 0.3
const ZOOM_MAX = 3
const ZOOM_STEP = 0.15
const PADDING_PX = 64 // 4rem (2rem de cada lado)
const A4_WIDTH_PX = (210 / 25.4) * 96

interface PrintZoomTargets {
  /** Container com overflow-auto (recebe wheel/touch). */
  scroller: Ref<HTMLElement | null>
  /** Wrapper dimensionado proporcionalmente ao zoom. */
  wrapper: Ref<HTMLElement | null>
  /** Folha A4 (#print-area) que recebe o transform. */
  sheet: Ref<HTMLElement | null>
}

function clamp(valor: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(valor * 1000) / 1000))
}

export function usePrintZoom(targets: PrintZoomTargets, active: Ref<boolean>) {
  const { scroller, wrapper, sheet } = targets
  const zoom = ref(1)
  let atual = 1
  let rafId = 0
  let pinch: { dist: number, zoom: number } | null = null
  let ro: ResizeObserver | null = null

  function agendarIndicador() {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      zoom.value = Math.round(atual * 100) / 100
    })
  }

  function aplicarLayout() {
    const s = sheet.value
    const w = wrapper.value
    if (!s || !w) return
    s.style.transformOrigin = '0 0'
    s.style.transform = `scale(${atual})`
    w.style.width = `${A4_WIDTH_PX * atual + PADDING_PX}px`
    w.style.height = `${s.offsetHeight * atual + PADDING_PX}px`
  }

  /** Aplica o zoom mantendo o ponto (clientX, clientY) estático na tela. */
  function aplicarZoom(novo: number, clientX?: number, clientY?: number) {
    const sc = scroller.value
    const s = sheet.value
    if (!sc || !s) return
    const alvo = clamp(novo)
    if (alvo === atual) return

    const viewport = sc.getBoundingClientRect()
    const fx = clientX ?? viewport.left + viewport.width / 2
    const fy = clientY ?? viewport.top + viewport.height / 2

    const antes = s.getBoundingClientRect()
    const ux = (fx - antes.left) / atual
    const uy = (fy - antes.top) / atual

    atual = alvo
    aplicarLayout()

    const depois = s.getBoundingClientRect()
    sc.scrollLeft += depois.left + ux * atual - fx
    sc.scrollTop += depois.top + uy * atual - fy
    agendarIndicador()
  }

  function zoomInicial() {
    return window.innerWidth < 640 ? 0.45 : 1
  }

  function onWheel(e: WheelEvent) {
    if (!e.ctrlKey) return
    e.preventDefault()
    aplicarZoom(atual * Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY)
  }

  function distancia(t: TouchList) {
    return Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY)
  }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) pinch = { dist: distancia(e.touches), zoom: atual }
  }

  function onTouchMove(e: TouchEvent) {
    if (e.touches.length !== 2 || !pinch) return
    e.preventDefault()
    const cx = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2
    const cy = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2
    aplicarZoom(pinch.zoom * (distancia(e.touches) / pinch.dist), cx, cy)
  }

  function onTouchEnd(e: TouchEvent) {
    if (e.touches.length < 2) pinch = null
  }

  function ligar() {
    const sc = scroller.value
    if (!sc) return
    atual = zoomInicial()
    aplicarLayout()
    zoom.value = atual
    sc.scrollTo({ left: 0, top: 0 })
    sc.addEventListener('wheel', onWheel, { passive: false })
    sc.addEventListener('touchstart', onTouchStart, { passive: true })
    sc.addEventListener('touchmove', onTouchMove, { passive: false })
    sc.addEventListener('touchend', onTouchEnd, { passive: true })
    sc.addEventListener('touchcancel', onTouchEnd, { passive: true })
    if (sheet.value && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => aplicarLayout())
      ro.observe(sheet.value)
    }
  }

  function desligar() {
    const sc = scroller.value
    if (sc) {
      sc.removeEventListener('wheel', onWheel)
      sc.removeEventListener('touchstart', onTouchStart)
      sc.removeEventListener('touchmove', onTouchMove)
      sc.removeEventListener('touchend', onTouchEnd)
      sc.removeEventListener('touchcancel', onTouchEnd)
    }
    ro?.disconnect()
    ro = null
    pinch = null
  }

  watch(active, (aberto) => {
    if (aberto) ligar()
    else desligar()
  }, { flush: 'post', immediate: true })

  onBeforeUnmount(() => {
    desligar()
    if (rafId) cancelAnimationFrame(rafId)
  })

  function handleZoomIn() {
    aplicarZoom(atual + ZOOM_STEP)
  }

  function handleZoomOut() {
    aplicarZoom(atual - ZOOM_STEP)
  }

  return { zoom, handleZoomIn, handleZoomOut }
}
