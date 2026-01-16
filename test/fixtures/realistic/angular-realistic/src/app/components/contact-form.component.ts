import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-contact-form',
  templateUrl: './contact-form.component.html',
  styleUrls: ['./contact-form.component.css']
})
export class ContactFormComponent {
  email = '';
  errorMessage = '';
  
  constructor(private http: HttpClient) {}
  
  async handleSubmit() {
    // CONFIRMED: Network promise that fails silently
    try {
      await this.http.post('/api/contact', { email: this.email }).toPromise();
      // Network request fails but no error message shown
    } catch (error) {
      // Error is silently swallowed
    }
  }
  
  validateEmail() {
    // CONFIRMED: Validation that should block but doesn't
    if (!this.email.includes('@')) {
      // Validation error should be shown but isn't
      return false;
    }
    return true;
  }
}

