import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent {
  count = 0;
  isOpen = false;
  
  constructor(
    private router: Router,
    private http: HttpClient
  ) {}
  
  navigateToAbout() {
    // CONFIRMED: Navigation promise that fails silently
    this.router.navigate(['/about']);
    // Navigation fails but no error feedback
  }
  
  async handleSubmit() {
    // CONFIRMED: Network promise that fails silently
    try {
      await this.http.post('/api/contact', {}).toPromise();
      // Network request fails but no UI feedback
    } catch (error) {
      // Error is silently swallowed
    }
  }
  
  trackAnalytics() {
    // FALSE POSITIVE TRAP: Analytics-only call
    this.http.post('/api/analytics/track', {}).subscribe();
    // Should NOT be reported as silent failure
  }
  
  toggleModal() {
    // CONFIRMED: State mutation that fails silently
    this.isOpen = !this.isOpen;
    // State doesn't actually change (bug)
  }
  
  incrementCount() {
    // CONFIRMED: State mutation that fails silently
    this.count = this.count + 1;
    // Count doesn't actually increment (bug)
  }
}

