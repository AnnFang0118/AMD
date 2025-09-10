// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import AppLayout from './AppLayout'
import AppLayoutChild from './AppLayoutChild'
import Login from './pages/Login'
import Home from './pages/Home'
import CalendarPage from './pages/CalendarPage'
import Register from './pages/Register'
import Settings from './pages/Settings'
import Search from './pages/Search'
import LinkChild from './pages/LinkChild'
import AccountSettings from './pages/AccountSettings'
// 子女端頁面
import ChildCalendar from './pages/ChildCalendar'
import ChildFeed from './pages/ChildFeed'
import ChildSettings from './pages/ChildSettings'
import ChildBoundInfo from './pages/ChildBoundInfo'
import ChildAccountSettings from './pages/ChildAccountSettings'
// 日記詳情（分開兩個）
import DiaryDetailUser from './pages/DiaryDetailUser'
import DiaryDetailChild from './pages/DiaryDetailChild'

const router = createBrowserRouter([
  // 登入頁（不經過 AppLayout 才不會看到底部選單）
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  // 進入網站一律先到登入
  { path: '/', element: <Navigate to="/login" replace /> },

  // ===== 使用者端（有手機殼：AppLayout）=====
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { path: 'home', element: <Home /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'search', element: <Search /> },
      { path: 'settings', element: <Settings /> },
      { path: 'diary1/:date', element: <DiaryDetailUser /> },
      { path: 'settings/link-child', element: <LinkChild /> },
      { path: 'settings/account', element: <AccountSettings /> },
           
    ],
  },

  // ===== 子女端（自己的手機殼：AppLayoutChild）=====
  {
    path: '/child',
    element: <AppLayoutChild />,
    children: [
     { path: 'childcalendar', element: <ChildCalendar /> },
      { path: 'childfeed', element: <ChildFeed /> },
      { path: 'childsetting', element: <ChildSettings /> },
      { index: true, element: <ChildCalendar /> },
      { path: 'diary2/:date', element: <DiaryDetailChild /> },
      { path: 'bound-info', element: <ChildBoundInfo /> },      // 顯示與誰綁定
      { path: 'account', element: <ChildAccountSettings /> },   
      
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
