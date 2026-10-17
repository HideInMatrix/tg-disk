export default defineNuxtRouteMiddleware(async () => {
  const { ready, loggedIn, fetch } = useUserSession();

  if (!ready.value) {
    await fetch();
  }

  if (!loggedIn.value) {
    return navigateTo("/login");
  }
});
