import os
import sys
import json
import asyncio
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support
import matplotlib.pyplot as plt
import seaborn as sns
from urllib.parse import urlparse
from analyze_url import URLAnalyzer
from utils.feature_extractor import URLFeatureExtractor

# Define the ground truth for benchmark URLs
# This dictionary maps URLs to their expected classification (0=legitimate, 1=phishing)
BENCHMARK_URLS = {
    # Legitimate URLs (class 0)
    "https://www.google.com": 0,
    "https://github.com/microsoft/vscode/tree/main/src/vs/editor/contrib": 0,
    "https://chat.openai.com/c/3e0b0a14-3b5c-4af0-9b10-ed96f15790db": 0,
    "https://www.amazon.com/dp/B09JFSMVH7/ref=sr_1_3?keywords=laptop&qid=1645544823": 0,
    "https://stackoverflow.com/questions/56254925/how-to-fix-installation-error": 0,
    "https://www.nytimes.com/2023/05/10/technology/ai-regulation-europe.html": 0,
    "https://www.reddit.com/r/ProgrammerHumor/comments/13m2vsf/hello_world/": 0,
    "https://www.linkedin.com/in/john-doe-12345678/": 0,
    "https://twitter.com/elonmusk/status/1656141749259726850": 0,
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ": 0,
    "https://www.instagram.com/p/CsdQ8-RLiKd/": 0,
    "https://docs.google.com/document/d/1abcdefghijklmnopqrstuvwxyz1234567890/edit": 0,
    "https://en.wikipedia.org/wiki/Machine_learning": 0,
    "https://www.bbc.com/news/world-asia-india-65066094": 0,
    
    # Phishing URLs (class 1)
    "https://www.paypa1.com/signin/verify?account=user": 1,
    "http://192.168.12.43/login/verify.php": 1,
    "https://secure-paypal.phishing-domain.com/login": 1,
    "https://login.microsoft.verify-account.tk/signin": 1,
    "https://badsite.com/www.paypal.com/login.html": 1,
    "https://www.faceb00k.com/login/recovery/password": 1,
    "https://arnazon.net/account/login/confirmation": 1,
    "https://microsoft-verify-security.com/account/update": 1,
    "https://netfl1x-billing-update.xyz/login": 1,
    "https://googledocs.security-viewdoc.ml/sharing": 1,
    "https://appleid.apple.com.signin-verification.info/": 1,
    "https://www.wellsfarg0-secure.com/account/verify.php": 1,
    "https://bankofamerica-secure.tk/login/auth": 1
}

class PhishingBenchmark:
    def __init__(self):
        self.analyzer = URLAnalyzer()
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.current_dir = os.path.dirname(os.path.abspath(__file__))
        self.output_dir = os.path.join(self.current_dir, 'machine learning', 'benchmarks')
        os.makedirs(self.output_dir, exist_ok=True)
        
    async def benchmark_url(self, url, expected_class, use_safe_browsing=False):
        """Benchmark a single URL and return analysis results"""
        try:
            result = await self.analyzer.analyze_url(url, use_safe_browsing)
            
            is_phishing = result.get("is_phishing", False)
            predicted_class = 1 if is_phishing else 0
            ml_result = result.get("ml_result", {})
            
            # Extract features
            features = ml_result.get("features", {})
            
            # Prepare result object
            benchmark_result = {
                'url': url,
                'domain': urlparse(url).netloc,
                'expected_class': expected_class,
                'predicted_class': predicted_class,
                'correct': predicted_class == expected_class,
                'risk_score': result.get("risk_score", 0),
                'ml_prediction': ml_result.get("prediction", 0),
                'ml_confidence': ml_result.get("confidence", 0),
                'phishing_probability': ml_result.get("phishing_probability", 0),
                'safe_probability': ml_result.get("safe_probability", 0),
                'has_ssl': features.get('tls_ssl_certificate', 0),
                'ip_based': features.get('domain_in_ip', 0),
                'url_length': features.get('length_url', 0),
                'directory_length': features.get('directory_length', 0),
                'dots_url': features.get('qty_dot_url', 0),
                'hyphens_url': features.get('qty_hyphen_url', 0)
            }
            
            return benchmark_result
            
        except Exception as e:
            print(f"Error analyzing URL {url}: {str(e)}")
            return {
                'url': url,
                'expected_class': expected_class,
                'error': str(e),
                'correct': False
            }
    
    async def benchmark_urls(self, urls_dict, use_safe_browsing=False):
        """Run benchmark on a dictionary of URLs with expected classes"""
        print(f"\n=== Starting Benchmark at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===")
        print(f"Benchmarking {len(urls_dict)} URLs")
        
        results = []
        count = 0
        
        for url, expected_class in urls_dict.items():
            count += 1
            print(f"\n[{count}/{len(urls_dict)}] Testing URL: {url}")
            print(f"  Expected: {'Phishing' if expected_class == 1 else 'Legitimate'}")
            
            # Run benchmark
            result = await self.benchmark_url(url, expected_class, use_safe_browsing)
            results.append(result)
            
            # Print result
            if 'error' in result:
                print(f"  Error: {result['error']}")
                continue
                
            print(f"  Predicted: {'Phishing' if result['predicted_class'] == 1 else 'Legitimate'}")
            print(f"  Correct: {'✓' if result['correct'] else '✗'}")
            print(f"  Risk Score: {result['risk_score']:.1f}")
            print(f"  ML Confidence: {result['ml_confidence']:.2%}")
                
        return results
    
    def analyze_results(self, results):
        """Analyze benchmark results and generate reports"""
        # Convert to DataFrame
        df = pd.DataFrame(results)
        
        # Filter out errors
        df = df[~df['url'].str.contains('error', na=False)]
        
        if len(df) == 0:
            print("No valid results to analyze")
            return None
        
        # Extract metrics
        y_true = df['expected_class'].values
        y_pred = df['predicted_class'].values
        
        # Calculate metrics
        accuracy = (df['correct'] == True).mean()
        precision, recall, f1, _ = precision_recall_fscore_support(
            y_true, y_pred, average='weighted'
        )
        
        # Split into legitimate and phishing sets
        legitimate_df = df[df['expected_class'] == 0]
        phishing_df = df[df['expected_class'] == 1]
        
        # Calculate false positive and false negative rates
        false_positives = legitimate_df[legitimate_df['predicted_class'] == 1]
        false_negatives = phishing_df[phishing_df['predicted_class'] == 0]
        
        fpr = len(false_positives) / len(legitimate_df) if len(legitimate_df) > 0 else 0
        fnr = len(false_negatives) / len(phishing_df) if len(phishing_df) > 0 else 0
        
        # Generate confusion matrix
        cm = confusion_matrix(y_true, y_pred)
        
        # Collect metrics
        metrics = {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'false_positive_rate': fpr,
            'false_negative_rate': fnr,
            'legitimate_accuracy': legitimate_df['correct'].mean(),
            'phishing_accuracy': phishing_df['correct'].mean(),
            'total_urls': len(df),
            'legitimate_urls': len(legitimate_df),
            'phishing_urls': len(phishing_df),
            'timestamp': self.timestamp
        }
        
        return df, metrics, cm
    
    def generate_report(self, df, metrics, cm):
        """Generate report and visualizations"""
        print("\n=== Benchmark Results ===")
        
        # Print metrics
        print("\nPerformance Metrics:")
        print(f"  Accuracy: {metrics['accuracy']:.2%}")
        print(f"  Precision: {metrics['precision']:.2%}")
        print(f"  Recall: {metrics['recall']:.2%}")
        print(f"  F1 Score: {metrics['f1_score']:.2%}")
        print(f"  False Positive Rate: {metrics['false_positive_rate']:.2%}")
        print(f"  False Negative Rate: {metrics['false_negative_rate']:.2%}")
        print(f"  Legitimate URL Accuracy: {metrics['legitimate_accuracy']:.2%}")
        print(f"  Phishing URL Accuracy: {metrics['phishing_accuracy']:.2%}")
        
        # Print confusion matrix
        print("\nConfusion Matrix:")
        print(cm)
        
        # Print classification report
        y_true = df['expected_class'].values
        y_pred = df['predicted_class'].values
        print("\nClassification Report:")
        print(classification_report(y_true, y_pred, target_names=["Legitimate", "Phishing"]))
        
        # List incorrectly classified URLs
        incorrect_df = df[df['correct'] == False]
        if len(incorrect_df) > 0:
            print("\nIncorrectly Classified URLs:")
            for _, row in incorrect_df.iterrows():
                expected = "Legitimate" if row['expected_class'] == 0 else "Phishing"
                predicted = "Legitimate" if row['predicted_class'] == 0 else "Phishing"
                print(f"  {row['url']}")
                print(f"    Expected: {expected}, Predicted: {predicted}, Risk Score: {row['risk_score']:.1f}")
                
        # Save detailed results
        self.save_results(df, metrics, cm)
    
    def generate_visualizations(self, df, cm):
        """Generate visualization charts"""
        try:
            # Create figures directory
            figures_dir = os.path.join(self.output_dir, 'figures')
            os.makedirs(figures_dir, exist_ok=True)
            
            # 1. Confusion Matrix
            plt.figure(figsize=(8, 6))
            sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                       xticklabels=["Legitimate", "Phishing"], 
                       yticklabels=["Legitimate", "Phishing"])
            plt.xlabel('Predicted')
            plt.ylabel('Actual')
            plt.title('Confusion Matrix')
            plt.tight_layout()
            plt.savefig(os.path.join(figures_dir, f'confusion_matrix_{self.timestamp}.png'))
            
            # 2. Risk Score Distribution
            plt.figure(figsize=(10, 6))
            sns.histplot(data=df, x='risk_score', hue='expected_class', 
                        bins=20, element='step', 
                        hue_order=[0, 1],
                        palette={0: 'green', 1: 'red'})
            plt.axvline(x=60, color='black', linestyle='--', label='Threshold')
            plt.title('Risk Score Distribution')
            plt.xlabel('Risk Score')
            plt.ylabel('Count')
            plt.legend(title='URL Type', labels=['Threshold (60)', 'Legitimate', 'Phishing'])
            plt.tight_layout()
            plt.savefig(os.path.join(figures_dir, f'risk_score_{self.timestamp}.png'))
            
            # 3. ML Confidence by Class
            plt.figure(figsize=(10, 6))
            sns.boxplot(data=df, x='expected_class', y='ml_confidence', 
                       order=[0, 1],
                       palette={0: 'green', 1: 'red'})
            plt.title('ML Confidence by URL Type')
            plt.xlabel('URL Type')
            plt.ylabel('ML Confidence')
            plt.xticks([0, 1], ['Legitimate', 'Phishing'])
            plt.tight_layout()
            plt.savefig(os.path.join(figures_dir, f'ml_confidence_{self.timestamp}.png'))
            
            # 4. URL Length Distribution
            plt.figure(figsize=(10, 6))
            sns.boxplot(data=df, x='expected_class', y='url_length',
                       order=[0, 1],
                       palette={0: 'green', 1: 'red'})
            plt.title('URL Length by URL Type')
            plt.xlabel('URL Type')
            plt.ylabel('URL Length')
            plt.xticks([0, 1], ['Legitimate', 'Phishing'])
            plt.tight_layout()
            plt.savefig(os.path.join(figures_dir, f'url_length_{self.timestamp}.png'))
            
            # 5. Feature Correlation
            feature_cols = ['risk_score', 'ml_confidence', 'url_length', 
                           'directory_length', 'dots_url', 'hyphens_url',
                           'has_ssl', 'ip_based']
            corr_df = df[feature_cols + ['expected_class', 'predicted_class', 'correct']]
            corr_matrix = corr_df.corr()
            
            plt.figure(figsize=(12, 10))
            sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', fmt='.2f', linewidths=0.5)
            plt.title('Feature Correlation Matrix')
            plt.tight_layout()
            plt.savefig(os.path.join(figures_dir, f'correlation_{self.timestamp}.png'))
            
            print(f"\nVisualizations saved to: {figures_dir}")
            
        except Exception as e:
            print(f"Error generating visualizations: {str(e)}")
    
    def save_results(self, df, metrics, cm):
        """Save benchmark results to files"""
        # Save results dataframe
        results_path = os.path.join(self.output_dir, f'benchmark_results_{self.timestamp}.csv')
        df.to_csv(results_path, index=False)
        
        # Save metrics
        metrics_path = os.path.join(self.output_dir, f'benchmark_metrics_{self.timestamp}.json')
        with open(metrics_path, 'w') as f:
            json.dump(metrics, f, indent=2)
        
        # Save confusion matrix
        cm_path = os.path.join(self.output_dir, f'confusion_matrix_{self.timestamp}.csv')
        pd.DataFrame(cm).to_csv(cm_path, index=False)
        
        # Save summary report
        report_path = os.path.join(self.output_dir, f'benchmark_report_{self.timestamp}.txt')
        
        with open(report_path, 'w') as f:
            f.write("PHISHING DETECTION BENCHMARK REPORT\n")
            f.write("=" * 50 + "\n\n")
            f.write(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("PERFORMANCE METRICS\n")
            f.write("-" * 25 + "\n")
            f.write(f"Accuracy: {metrics['accuracy']:.2%}\n")
            f.write(f"Precision: {metrics['precision']:.2%}\n")
            f.write(f"Recall: {metrics['recall']:.2%}\n")
            f.write(f"F1 Score: {metrics['f1_score']:.2%}\n")
            f.write(f"False Positive Rate: {metrics['false_positive_rate']:.2%}\n")
            f.write(f"False Negative Rate: {metrics['false_negative_rate']:.2%}\n\n")
            
            f.write("TEST DATASET\n")
            f.write("-" * 25 + "\n")
            f.write(f"Total URLs: {metrics['total_urls']}\n")
            f.write(f"Legitimate URLs: {metrics['legitimate_urls']}\n")
            f.write(f"Phishing URLs: {metrics['phishing_urls']}\n\n")
            
            f.write("CONFUSION MATRIX\n")
            f.write("-" * 25 + "\n")
            f.write("             Predicted      \n")
            f.write("             Legit  Phishing\n")
            f.write(f"Actual Legit  {cm[0][0]}     {cm[0][1]}\n")
            f.write(f"      Phishing {cm[1][0]}     {cm[1][1]}\n\n")
            
            # List incorrectly classified URLs
            incorrect_df = df[df['correct'] == False]
            if len(incorrect_df) > 0:
                f.write("INCORRECTLY CLASSIFIED URLs\n")
                f.write("-" * 25 + "\n")
                for _, row in incorrect_df.iterrows():
                    expected = "Legitimate" if row['expected_class'] == 0 else "Phishing"
                    predicted = "Legitimate" if row['predicted_class'] == 0 else "Phishing"
                    f.write(f"URL: {row['url']}\n")
                    f.write(f"  Expected: {expected}, Predicted: {predicted}\n")
                    f.write(f"  Risk Score: {row['risk_score']:.1f}, ML Confidence: {row['ml_confidence']:.2%}\n\n")
            
            f.write("\nRECOMMENDATIONS\n")
            f.write("-" * 25 + "\n")
            
            # Add recommendations based on results
            if metrics['false_positive_rate'] > 0.1:
                f.write("• High false positive rate detected. Consider adjusting the model to be less aggressive\n")
                f.write("  on legitimate URLs with complex structures.\n")
            
            if metrics['false_negative_rate'] > 0.1:
                f.write("• High false negative rate detected. Consider increasing sensitivity\n")
                f.write("  for phishing detection patterns.\n")
            
            if metrics['accuracy'] < 0.9:
                f.write("• Overall accuracy below 90%. Model retraining with misclassified examples recommended.\n")
        
        # Generate visualizations
        self.generate_visualizations(df, cm)
        
        print(f"\nResults saved to: {self.output_dir}")
        print(f"Detailed report: {report_path}")
        
        return results_path, metrics_path, report_path
    
    def create_retraining_recommendation(self, df, metrics):
        """Create recommendations for retraining"""
        needs_retraining = False
        reasons = []
        
        if metrics['accuracy'] < 0.9:
            needs_retraining = True
            reasons.append("Overall accuracy below 90%")
        
        if metrics['false_positive_rate'] > 0.1:
            needs_retraining = True
            reasons.append("False positive rate above 10%")
        
        if metrics['false_negative_rate'] > 0.1:
            needs_retraining = True
            reasons.append("False negative rate above 10%")
        
        # Get misclassified examples
        incorrect_df = df[df['correct'] == False]
        false_positives = df[(df['expected_class'] == 0) & (df['predicted_class'] == 1)]
        false_negatives = df[(df['expected_class'] == 1) & (df['predicted_class'] == 0)]
        
        # Prepare retraining data
        retraining_data = {
            "timestamp": self.timestamp,
            "needs_retraining": needs_retraining,
            "reasons": reasons,
            "metrics": {k: float(v) for k, v in metrics.items() if isinstance(v, (int, float))},
            "false_positives": false_positives['url'].tolist(),
            "false_negatives": false_negatives['url'].tolist(),
            "all_incorrect": incorrect_df['url'].tolist()
        }
        
        # Save recommendation
        retraining_path = os.path.join(self.output_dir, 'retraining_recommendation.json')
        with open(retraining_path, 'w') as f:
            json.dump(retraining_data, f, indent=2)
        
        if needs_retraining:
            print("\n⚠️ Model retraining is recommended for the following reasons:")
            for reason in reasons:
                print(f"  • {reason}")
            print(f"\nRetraining recommendation saved to: {retraining_path}")
        else:
            print("\n✓ Model performance is satisfactory. Retraining not necessary.")
        
        return retraining_data

async def run_benchmark(use_safe_browsing=False):
    """Run the benchmark process"""
    benchmark = PhishingBenchmark()
    
    try:
        # Run benchmark on defined URLs
        print("\nStarting benchmark with predefined URLs...")
        results = await benchmark.benchmark_urls(BENCHMARK_URLS, use_safe_browsing)
        
        # Analyze results
        df, metrics, cm = benchmark.analyze_results(results)
        
        # Generate report
        benchmark.generate_report(df, metrics, cm)
        
        # Create retraining recommendation
        benchmark.create_retraining_recommendation(df, metrics)
        
        return df, metrics
        
    except Exception as e:
        print(f"Benchmark failed: {str(e)}")
        return None, None

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Benchmark phishing detection model")
    parser.add_argument("--safe-browsing", action="store_true", 
                        help="Use Google Safe Browsing API (slower but more accurate)")
    parser.add_argument("--custom-file", type=str,
                        help="Path to custom URLs file (CSV with url,is_phishing columns)")
    
    args = parser.parse_args()
    
    # Run benchmark
    asyncio.run(run_benchmark(args.safe_browsing))

if __name__ == "__main__":
    import argparse
    main()
