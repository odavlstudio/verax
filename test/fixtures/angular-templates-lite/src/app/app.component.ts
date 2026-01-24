// Angular Templates Lite - TypeScript Component for PHASE 3 Integration Testing
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  dynamicPath = '/dynamic';
  categoryId = '123';
  
  constructor(private router: Router) {}
  
  // Static router.navigate with all literal segments - should be extracted and joined to /checkout/confirm
  goToCheckout() {
    this.router.navigate(['/checkout', 'confirm']);
  }
  
  // Static router.navigateByUrl with literal string - should be extracted
  goToContact() {
    this.router.navigateByUrl('/contact');
  }
  
  // Dynamic router.navigate with variable - should be SKIPPED (dynamic)
  goToDynamic() {
    this.router.navigate(['/user', this.categoryId]);
  }
  
  // Dynamic router.navigateByUrl with template string - should be SKIPPED (dynamic)
  goToUser(id: string) {
    this.router.navigateByUrl(`/user/${id}`);
  }
  
  // Param route in navigate - should be SKIPPED (params)
  goToProfile() {
    this.router.navigate(['/profile/:id']);
  }
  
  getFormAction() {
    return '/dynamic-action';
  }
}
