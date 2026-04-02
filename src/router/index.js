import { createRouter, createWebHistory } from 'vue-router'
import ProjectorView from '../views/ProjectorView.vue'
import PlayerView from '../views/PlayerView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: ProjectorView },
    { path: '/player', component: PlayerView }
  ]
})

export default router
