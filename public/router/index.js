import Landing from "../components/Landing.js";
import Studio from "../components/Studio.js";
import Waterfall from "../components/waterfall/Waterfall.js";

const routes = [
  {
    path: "/",
    component: Landing,
    name: "landing",
  },
  {
    path: "/studio",
    component: Studio,
    name: "studio",
    // requiresAuth:true,
  },
  {
    path: "/waterfall",
    component: Waterfall,
    name: "waterfall",
    // requiresAuth:true,
  },
];

const router = VueRouter.createRouter({
  history: VueRouter.createWebHistory(),
  routes,
});

// Navigation guard
router.beforeEach((to, from, next) => {
  const loggedIn = true;

  // If route requires auth and user is not logged in
  if (to.meta.requiresAuth && !loggedIn.value) {
    // Redirect to landing page
    next({ name: "landing" });
  } else {
    // Otherwise proceed as normal
    next();
  }
});

export default router;
