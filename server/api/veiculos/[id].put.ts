import { veiculoSchema, type Veiculo } from '../../utils/veiculos'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const idNumber = Number(id)

  if (!idNumber || Number.isNaN(idNumber)) {
    throw createError({ statusCode: 400, statusMessage: 'ID inválido' })
  }

  const body = await readBody(event)
  const resultado = veiculoSchema.safeParse(body)

  if (!resultado.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados do veículo inválidos',
      data: resultado.error.flatten()
    })
  }

  const storage = useStorage('data')
  const veiculos = await storage.getItem<Veiculo[]>('veiculos') ?? []

  const index = veiculos.findIndex((v) => v.id === idNumber)

  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Veículo não encontrado' })
  }

  const novo = resultado.data
  const placaNormalizada = novo.placa.replace(/[^A-Z0-9]/g, '').toUpperCase()

  const duplicado = veiculos.some((v, i) => {
    if (i === index) return false
    return v.placa.replace(/[^A-Z0-9]/g, '').toUpperCase() === placaNormalizada
  })

  if (duplicado) {
    throw createError({ statusCode: 409, statusMessage: 'Placa já cadastrada em outro veículo' })
  }

  veiculos[index] = { ...novo, id: idNumber }
  await storage.setItem('veiculos', veiculos)

  return veiculos[index]
})