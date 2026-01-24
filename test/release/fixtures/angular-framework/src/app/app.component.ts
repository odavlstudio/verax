import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  name = '';
  dynamicPath = '/dashboard';

  constructor(private router: Router) {}

  navigateToDashboard() {
    // Dynamic navigation - should be skipped
    this.router.navigateByUrl(this.dynamicPath);
  }

  goToAbout() {
    // Static navigation - should be extracted
    this.router.navigate(['/about']);
  }

  goToContact() {
    this.router.navigateByUrl('/contact');
  }
}
