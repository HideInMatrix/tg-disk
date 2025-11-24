// import { useIPFS } from "~~/server/utils/ipfs"


export default defineEventHandler(async (event) => {
    try {

        const body = await readFormData(event)
        const fileBlob = body.get('file') as Blob | null // Here, we explicitly cast to Blob | null
        let deviceId = body.get('deviceId')?.toString()
        if (!fileBlob) {
            throw new Error('文件必传')
        }
        const file = new File([fileBlob], body.get('fileName')?.toString() || 'unknown', { type: fileBlob.type })
        // await useIPFS(file)

    } catch (e) {
        //TODO handle the exception
        throw createError({ statusCode: 500, statusMessage: (e as Error).message })
    }


})