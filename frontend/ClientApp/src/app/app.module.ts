import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { NouisliderModule } from 'ng2-nouislider';
import { AppComponent } from './app.component';
import { NavMenuComponent } from './nav-menu/nav-menu.component';
import { HomeComponent } from './home/home.component';
import { ProblemComponent } from './problem/problem.component';
import { AddProblemComponent } from './add-problem/add-problem.component';
import { LedsService } from './services/leds.service';
import { ProblemsService } from './services/problems.service';
import { VDifficultyFormatter } from './vdifficultyformatter';

@NgModule({
  declarations: [
    AppComponent,
    NavMenuComponent,
    HomeComponent,
    ProblemComponent,
    AddProblemComponent
  ],
  imports: [
    BrowserModule.withServerTransition({ appId: 'ng-cli-universal' }),
    HttpClientModule,
    FormsModule,
    NouisliderModule,
    RouterModule.forRoot([
      { path: '', component: HomeComponent, pathMatch: 'full' },
      { path: 'problem', component: ProblemComponent },
      { path: 'add-problem', component: AddProblemComponent }
    ])
  ],
  providers: [
    LedsService,
    ProblemsService,
    VDifficultyFormatter],
  bootstrap: [AppComponent]
})
export class AppModule { }
