export default defineNuxtRouteMiddleware(async () => {
  const { ready, loggedIn, fetch } = useUserSession();
  const config = useRuntimeConfig();
  const authRequired = Boolean(config.public.account && config.public.password);

  // 之后设置录账户才启用登录验证的措施
  if (!authRequired) return;

  if (!ready.value) {
    await fetch();
  }

  if (!loggedIn.value) {
    return navigateTo("/login");
  }
});
