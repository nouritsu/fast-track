import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { paintStatusBar } from './lib/theme'

// index.html picked the theme; the system bars follow it.
paintStatusBar()

export default mount(App, { target: document.getElementById('app')! })
