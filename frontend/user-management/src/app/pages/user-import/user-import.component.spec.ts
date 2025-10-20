import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserImportComponent } from './user-import.component';

describe('UserImportComponent', () => {
  let component: UserImportComponent;
  let fixture: ComponentFixture<UserImportComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [UserImportComponent]
    });
    fixture = TestBed.createComponent(UserImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
