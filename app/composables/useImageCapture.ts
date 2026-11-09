import type { Ref } from 'vue'
import { domToBlob } from 'modern-screenshot'

export function useImageCapture(target: Ref<HTMLElement | null>) {
  const toast = useToast()
  const isCapturing = ref(false)
  const hasCopied = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function handleCapture() {
    const el = target.value
    if (!el || isCapturing.value) return

    isCapturing.value = true
    const transformSalvo = el.style.transform
    el.style.transform = 'none'

    try {
      const blobPromise = domToBlob(el, { scale: 2, backgroundColor: '#fff' })
      // Promise direto no ClipboardItem preserva o gesto do usuário (Safari).
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blobPromise.then((b) => {
          if (!b) throw new Error('Falha ao gerar imagem')
          return b
        }) })
      ])
      hasCopied.value = true
      toast.add({ title: 'Imagem copiada', color: 'success' })
      clearTimeout(timer)
      timer = setTimeout(() => { hasCopied.value = false }, 2000)
    } catch {
      toast.add({
        title: 'Não foi possível copiar a imagem',
        description: 'Verifique as permissões do navegador e tente novamente.',
        color: 'error'
      })
    } finally {
      el.style.transform = transformSalvo
      isCapturing.value = false
    }
  }

  onBeforeUnmount(() => clearTimeout(timer))

  return { isCapturing, hasCopied, handleCapture }
}
