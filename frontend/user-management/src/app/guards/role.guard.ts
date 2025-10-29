import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    
    // 👇 CORREGIDO: Buscar 'roles' (plural) en lugar de 'requiredRole'
    const requiredRoles = route.data['roles'] as string[];
    const userRole = this.authService.getRole();

    console.log('🛡️ RoleGuard - Verificando acceso');
    console.log('   Roles requeridos:', requiredRoles);
    console.log('   Rol del usuario:', userRole);
    console.log('   URL solicitada:', state.url);

    // Si no hay rol de usuario, redirigir a login
    if (!userRole) {
      console.log('❌ RoleGuard - No hay rol, redirigiendo a /login');
      return this.router.createUrlTree(['/login']);
    }

    // Verificar si el rol del usuario está en los roles requeridos
    if (requiredRoles && requiredRoles.includes(userRole)) {
      console.log('✅ RoleGuard - Acceso permitido');
      return true;
    }

    // 👇 CORREGIDO: Redirigir a /products en lugar de /forbidden
    console.log('❌ RoleGuard - Acceso denegado, redirigiendo a /products');
    console.log(`   Usuario con rol "${userRole}" intentó acceder a ruta que requiere: ${requiredRoles.join(', ')}`);
    
    return this.router.createUrlTree(['/products']);
  }
}