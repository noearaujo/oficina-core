
import { veiculoSchema, type Veiculo } from '../../utils/veiculos'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const resultado = veiculoSchema.safeParse(body)

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados do veículo inválidos.',
      data: resultado.error.flatten()
    })
  }

  const storage = useStorage('data')
  const veiculos = await storage.getItem<Veiculo[]>('veiculos') ?? []

  const placaExiste = veiculos.some(
    veiculo => veiculo.placa === resultado.data.placa
  )

  if (placaExiste) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Já existe um veículo cadastrado com essa placa.'
    })
  }

  const novoVeiculo: Veiculo = {
    id: Date.now(),
    ...resultado.data
  }

  veiculos.push(novoVeiculo)
  await storage.setItem('veiculos', veiculos)

  return novoVeiculo
})
