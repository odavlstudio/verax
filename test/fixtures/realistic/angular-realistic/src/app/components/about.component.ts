import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css']
})
export class AboutComponent {
  loaded = false;
  
  constructor(private http: HttpClient) {}
  
  async loadData() {
    // CONFIRMED: Network promise that fails silently
    try {
      await this.http.get('/api/about').toPromise();
      this.loaded = true;
      // Network fails but no loading indicator or error shown
    } catch (error) {
      // Error is silently swallowed
    }
  }
}

