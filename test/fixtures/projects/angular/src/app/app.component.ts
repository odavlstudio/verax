import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  count = 0;
  message = '';
  submitted = false;

  increment() {
    this.count++;
  }

  handleSubmit() {
    this.submitted = true;
  }
}
