export default defineEventHandler(async (event) => {
    const { account, password } = await readBody(event)
    const config = useRuntimeConfig()

    if (config.public.account && config.public.password && config.public.account == account && config.public.password == password) {
        await setUserSession(event, {
            // User data
            user: {
                login: 'atinux'
            },
            // Private data accessible only on server/ routes
            secure: {
                apiToken: '1234567890'
            },
            // Any extra fields for the session data
            loggedInAt: new Date()
        }, {
            maxAge: 60 * 60 * 24 * 7,
        })
        return {code:200,data:true}
    }else if(!config.public.account && !config.public.password){
        return {code:200,data:true}
    }else{
        return {code:401,data:false}
    }
})