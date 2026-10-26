// auth.d.ts
declare module '#auth-utils' {
  interface User {
    login: "admin"
  }

  interface UserSession {
    loggedInAt?: string | Date
  }

  interface SecureSessionData {
    accountAuth?: boolean
    // 兼容旧版账号密码会话；不会在浏览器会话响应中返回。
    apiToken?: string
  }
}

export {}
