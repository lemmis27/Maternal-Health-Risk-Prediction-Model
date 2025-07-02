# maternal_health_project/evaluation.py

import numpy as np
import logging
from typing import Any, Dict, List, Optional
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix, recall_score
from sklearn.calibration import calibration_curve

def calculate_clinical_cost(y_true: np.ndarray, y_pred: np.ndarray, class_names: List[str],
                          risk_costs: Dict[str, float],
                          logger: logging.Logger) -> float:
    """
    Calculate clinical cost based on a misclassification matrix.

    Args:
        y_true (np.ndarray): True labels.
        y_pred (np.ndarray): Predicted labels.
        class_names (List[str]): List of class names corresponding to numerical labels.
        risk_costs (Dict[str, float]): Dictionary defining costs for different types of misclassifications.
        logger (logging.Logger): The logger instance.

    Returns:
        float: The total calculated clinical cost.
    """
    # Define the cost matrix based on provided risk_costs
    cost_matrix = {
        'high risk': {
            'low risk': risk_costs.get('false_negative_high', 0),
            'mid risk': risk_costs.get('false_negative_high', 0)
        },
        'mid risk': {
            'low risk': risk_costs.get('false_negative_mid', 0),
            'high risk': risk_costs.get('false_positive_mid', 0) # Assuming false_positive_mid for mid->high
        },
        'low risk': {
            'mid risk': risk_costs.get('false_positive_low', 0), # Assuming false_positive_low for low->mid
            'high risk': risk_costs.get('false_positive_low', 0) # Assuming false_positive_low for low->high
        }
    }

    clinical_cost = 0
    unique_classes = np.unique(y_true)

    for true_class_idx in unique_classes:
        for pred_class_idx in unique_classes:
            if true_class_idx != pred_class_idx: # Only consider misclassifications
                true_name = class_names[true_class_idx]
                pred_name = class_names[pred_class_idx]

                # Count misclassifications for this specific true_class -> pred_class pair
                misclassifications = np.sum((y_true == true_class_idx) & (y_pred == pred_class_idx))

                # Get the cost from the cost matrix, default to 0 if not defined
                cost = cost_matrix.get(true_name, {}).get(pred_name, 0)

                clinical_cost += misclassifications * cost
                if misclassifications > 0 and cost > 0:
                    logger.debug(f"Misclassification: True '{true_name}' (idx {true_class_idx}) "
                                 f"predicted as '{pred_name}' (idx {pred_class_idx}). "
                                 f"Count: {misclassifications}, Cost per: {cost}, Total: {misclassifications * cost}")

    logger.info(f"Calculated total clinical cost: {clinical_cost}")
    return clinical_cost

def calculate_calibration_curve(y_true: np.ndarray, y_pred_proba: np.ndarray, class_names: List[str],
                              logger: logging.Logger) -> Dict[str, List]:
    """
    Calculate calibration curve data for the 'high risk' class.

    Args:
        y_true (np.ndarray): True labels.
        y_pred_proba (np.ndarray): Predicted probabilities for each class.
        class_names (List[str]): List of class names corresponding to numerical labels.
        logger (logging.Logger): The logger instance.

    Returns:
        Dict[str, List]: A dictionary containing 'prob_true' and 'prob_pred' lists for the calibration curve.
                         Returns empty lists if 'high risk' class is not found or has no samples.
    """
    try:
        # Find the index of 'high risk' class
        high_risk_idx = list(class_names).index('high risk')

        # Create a binary true label array for 'high risk' vs. others
        y_true_binary = (y_true == high_risk_idx).astype(int)

        # Get probabilities for the 'high risk' class
        y_proba_high = y_pred_proba[:, high_risk_idx]

        # Only calculate if there are actual 'high risk' samples in y_true_binary
        if np.sum(y_true_binary) > 0:
            prob_true, prob_pred = calibration_curve(
                y_true_binary, y_proba_high, n_bins=5, strategy='quantile'
            )
            logger.info("Calibration curve calculated for 'high risk' class.")
            return {
                'prob_true': prob_true.tolist(),
                'prob_pred': prob_pred.tolist()
            }
        else:
            logger.warning("No 'high risk' samples found in y_true for calibration curve calculation. Returning empty data.")
            return {'prob_true': [], 'prob_pred': []}

    except (ValueError, IndexError) as e:
        logger.warning(f"Could not calculate calibration curve (class not found or index error): {e}", exc_info=True)
        return {'prob_true': [], 'prob_pred': []}
    except Exception as e:
        logger.error(f"An unexpected error occurred during calibration curve calculation: {e}", exc_info=True)
        return {'prob_true': [], 'prob_pred': []}

def clinical_model_evaluation(model: Any, X: np.ndarray, y: np.ndarray, class_names: List[str],
                            risk_costs: Dict[str, float],
                            logger: Optional[logging.Logger] = None) -> Dict[str, Any]:
    """
    Performs a comprehensive clinical evaluation of the model, including standard metrics,
    clinical cost, and calibration data.

    Args:
        model (Any): The trained machine learning model (must have predict and predict_proba methods).
        X (np.ndarray): Feature data for evaluation.
        y (np.ndarray): True labels for evaluation.
        class_names (List[str]): List of class names corresponding to numerical labels.
        risk_costs (Dict[str, float]): Dictionary defining costs for different types of misclassifications.
        logger (Optional[logging.Logger]): The logger instance.

    Returns:
        Dict[str, Any]: A dictionary containing various evaluation metrics and data.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    logger.info("Starting clinical model evaluation")

    y_pred = model.predict(X)
    y_pred_proba = model.predict_proba(X)

    # Basic metrics
    accuracy = accuracy_score(y, y_pred)
    f1 = f1_score(y, y_pred, average='weighted')

    # Recall for each class
    unique_classes = np.unique(y)
    # Ensure labels are passed to recall_score to handle cases where a class might be missing in y_pred
    recalls = recall_score(y, y_pred, average=None, labels=unique_classes)
    recalls_dict = {f"recall_{class_names[i]}": recalls[j]
                   for j, i in enumerate(unique_classes)}

    # Confusion matrix
    cm = confusion_matrix(y, y_pred)

    # Clinical cost calculation
    clinical_cost = calculate_clinical_cost(y, y_pred, class_names, risk_costs, logger)

    # Calibration curve for high risk
    calibration_data = calculate_calibration_curve(y, y_pred_proba, class_names, logger)

    results = {
        'accuracy': accuracy,
        'f1_weighted': f1,
        'clinical_cost': clinical_cost,
        **recalls_dict,
        'confusion_matrix': cm.tolist(),
        'calibration': calibration_data
    }

    logger.info(f"Evaluation complete - Accuracy: {accuracy:.4f}, F1: {f1:.4f}, Cost: {clinical_cost}")
    return results

