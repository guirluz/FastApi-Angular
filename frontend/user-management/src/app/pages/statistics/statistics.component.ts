import { Component, OnInit } from '@angular/core';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css']
})
export class StatisticsComponent implements OnInit {
  mostRented: any[] = [];
  incomeByProduct: any[] = [];

  constructor(private productService: ProductService) { }

  ngOnInit(): void {
    this.loadStatistics();
  }

  loadStatistics(): void {
    this.productService.getStatistics().subscribe(
      (data) => {
        this.mostRented = data.most_rented;
        this.incomeByProduct = data.income_by_product;
      },
      (error) => {
        console.error('Error loading statistics', error);
      }
    );
  }
}