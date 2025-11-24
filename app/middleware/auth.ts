export default defineNuxtRouteMiddleware((to, from) => {
  const { loggedIn } = useUserSession(); // 例如 Pinia 用户状态
  const config = useRuntimeConfig();

  // 之后设置录账户才启用登录验证的措施
  if (config.public.account && !loggedIn.value) {
    return navigateTo("/login");
  }
});
