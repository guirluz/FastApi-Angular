import { Component, OnInit } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css']
})
export class StatisticsComponent implements OnInit {
  // Datos para gráfico de barras
  barChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  barChartOptions: ChartConfiguration<'bar'>['options'] = { responsive: true };

  // Datos para gráfico de torta
  pieChartData: ChartConfiguration<'pie'>['data'] = { labels: [], datasets: [] };
  pieChartOptions: ChartConfiguration<'pie'>['options'] = { responsive: true };

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadStatistics();
  }

  loadStatistics(): void {
    this.productService.getStatistics().subscribe(
      (data) => {
        // Productos más rentados
        const labelsRented = data.most_rented.map((item: any) => item.product);
        const dataRented = data.most_rented.map((item: any) => item.rentals);

        this.barChartData = {
          labels: labelsRented,
          datasets: [
            { data: dataRented, label: 'Cantidad de rentas', backgroundColor: '#6b8e9f' }
          ]
        };

        // Ingresos por producto
        const labelsIncome = data.income_by_product.map((item: any) => item.product);
        const dataIncome = data.income_by_product.map((item: any) => item.income);

        this.pieChartData = {
          labels: labelsIncome,
          datasets: [
            { data: dataIncome, backgroundColor: ['#6b8e9f', '#a3c4d9', '#d9b38c', '#c96b6b', '#8fc96b'] }
          ]
        };
      },
      (error) => {
        console.error('Error loading statistics', error);
      }
    );
  }
}
