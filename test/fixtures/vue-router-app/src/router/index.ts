import { createRouter, createWebHistory } from 'vue-router';
import Home from '../components/Home.vue';
import About from '../components/About.vue';
import Users from '../components/Users.vue';
import UserProfile from '../components/UserProfile.vue';

const routes = [
  {
    path: '/',
    component: Home
  },
  {
    path: '/about',
    component: About
  },
  {
    path: '/users',
    component: Users,
    children: [
      {
        path: 'profile',
        component: UserProfile
      }
    ]
  },
  {
    path: '/user/:id',
    component: UserProfile
  }
];

export default createRouter({
  history: createWebHistory(),
  routes
});
