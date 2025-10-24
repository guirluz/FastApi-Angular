import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Components
import { LoginComponent } from './pages/auth/login/login.component';
import { RegisterComponent } from './pages/auth/register/register.component';
import { UserListComponent } from './pages/user-list/user-list.component';
import { UserCreateComponent } from './pages/user-create/user-create.component';
import { UserEditComponent } from './pages/user-edit/user-edit.component';
import { UserImportComponent } from './pages/user-import/user-import.component';
import { UserProfileComponent } from './pages/user-profile/user-profile.component';

// Guards
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: 'users',
    component: UserListComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { requiredRole: 'admin' }
  },
  {
    path: 'users/create',
    component: UserCreateComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { requiredRole: 'admin' }
  },
  {
    path: 'users/edit/:id',
    component: UserEditComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { requiredRole: 'admin' }
  },
  {
    path: 'users/import',
    component: UserImportComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { requiredRole: 'admin' }
  },
  {
    path: 'profile',
    component: UserProfileComponent,
    canActivate: [AuthGuard]
  },
  { path: '', redirectTo: '/users', pathMatch: 'full' },
  { path: '**', redirectTo: '/users' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }


