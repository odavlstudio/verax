import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '../components/HomePage.vue';
import AboutPage from '../components/AboutPage.vue';
import ContactForm from '../components/ContactForm.vue';
import UserProfile from '../components/UserProfile.vue';
import LoginForm from '../components/LoginForm.vue';

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage
  },
  {
    path: '/about',
    name: 'about',
    component: AboutPage
  },
  {
    path: '/contact',
    name: 'contact',
    component: ContactForm
  },
  {
    path: '/user/:id',
    name: 'user',
    component: UserProfile
  },
  {
    path: '/login',
    name: 'login',
    component: LoginForm
  }
];

export default createRouter({
  history: createWebHistory(),
  routes
});

